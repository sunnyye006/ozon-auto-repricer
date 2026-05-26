from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.ext.asyncio import AsyncSession

from app.events import event_bus
from app.models import PriceEvent, Product, RepricingState, Store
from app.services.app_settings_service import RepricingRules


TWO_DP = Decimal("0.01")


def q(value: Decimal) -> Decimal:
    return value.quantize(TWO_DP, rounding=ROUND_HALF_UP)


@dataclass
class EngineResult:
    changed: bool
    reason: str


class PricingEngine:
    """
    跟卖调价三规则：

    规则一：存在对手价低于我方 → 压价至「最低对手价 − 步长」；已到位且对手未再降则维持；
            对手再降则继续压价；触及成本价后停止。
    规则二：跟价过程中我方已是最低价，部分对手退出或不跟价但仍有其他对手 →
            回调至「仍高于我方的最低对手价 − 步长」，始终保持全场最低价。
    规则三：链接内无任何竞争参考价 → 价格不变。
    """

    async def process_product(
        self,
        db: AsyncSession,
        store: Store,
        product: Product,
        state: RepricingState,
        competitor_prices: list[Decimal],
        rules: RepricingRules,
    ) -> EngineResult:
        now = datetime.now(timezone.utc)
        state.last_scan_at = now
        state.competitor_count = len(competitor_prices)
        floor = q(product.cost_price)

        # 规则三：无竞争对手
        if not competitor_prices:
            if state.in_round:
                state.in_round = False
                state.round_original_price = None
                state.floor_reached = False
            return EngineResult(changed=False, reason="no_competitors_unchanged")

        min_competitor = min(competitor_prices)

        # 规则一：对手价低于我方 → 跟价压价
        if min_competitor < product.current_price:
            if not state.in_round:
                state.in_round = True
                state.round_original_price = product.current_price
                state.floor_reached = False
            return await self._decrease_to_target(
                db, store, product, state, target=self._undercut_target(min_competitor, rules.price_step, floor)
            )

        # 我方已不高于任何对手（当前为最低价或持平）
        if not state.in_round:
            return EngineResult(changed=False, reason="already_lowest_idle")

        competitors_above = [p for p in competitor_prices if p > product.current_price]

        # 规则二：仍有对手，且存在高于我方的报价 → 回调至其下方一步，保持最低价
        if competitors_above:
            min_above = min(competitors_above)
            target = self._undercut_target(min_above, rules.price_step, floor)
            if target > product.current_price:
                return await self._raise_to_target(
                    db, store, product, state, target=target, note="raise_to_stay_lowest"
                )
            return EngineResult(changed=False, reason="already_optimal_below_next_competitor")

        # 与最低对手持平 → 再低一步以严格保持最低价
        if min_competitor == product.current_price:
            target = self._undercut_target(min_competitor, rules.price_step, floor)
            if target < product.current_price:
                return await self._decrease_to_target(db, store, product, state, target=target)

        return EngineResult(changed=False, reason="maintain_lowest_position")

    def _undercut_target(self, competitor_price: Decimal, step: Decimal, floor: Decimal) -> Decimal:
        target = q(competitor_price - step)
        if target < floor:
            return floor
        return target

    async def _decrease_to_target(
        self,
        db: AsyncSession,
        store: Store,
        product: Product,
        state: RepricingState,
        *,
        target: Decimal,
    ) -> EngineResult:
        floor = q(product.cost_price)
        if target <= floor and product.current_price <= floor:
            state.floor_reached = True
            return EngineResult(changed=False, reason="at_cost_floor")

        if product.current_price <= target:
            return EngineResult(changed=False, reason="maintain_undercut_position")

        if target == floor:
            state.floor_reached = True

        old_price = product.current_price
        product.current_price = target
        await self._emit_event(
            db=db,
            store=store,
            product=product,
            direction="↓",
            old_price=old_price,
            new_price=target,
            note="undercut_competitor",
        )
        return EngineResult(changed=True, reason="undercut")

    async def _raise_to_target(
        self,
        db: AsyncSession,
        store: Store,
        product: Product,
        state: RepricingState,
        *,
        target: Decimal,
        note: str,
    ) -> EngineResult:
        if target <= product.current_price:
            return EngineResult(changed=False, reason="raise_not_needed")

        old_price = product.current_price
        product.current_price = target
        await self._emit_event(
            db=db,
            store=store,
            product=product,
            direction="↑",
            old_price=old_price,
            new_price=target,
            note=note,
        )
        return EngineResult(changed=True, reason="raise")

    async def _emit_event(
        self,
        db: AsyncSession,
        store: Store,
        product: Product,
        direction: str,
        old_price: Decimal,
        new_price: Decimal,
        note: str,
    ) -> None:
        event = PriceEvent(
            platform="Ozon",
            store_name=store.name,
            product_name=product.name,
            direction=direction,
            old_price=old_price,
            new_price=new_price,
            note=note,
        )
        db.add(event)
        await event_bus.publish(
            {
                "platform": "Ozon",
                "store_name": store.name,
                "product_name": product.name,
                "direction": direction,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "old_price": str(old_price),
                "new_price": str(new_price),
            }
        )
