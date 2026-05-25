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

        if not competitor_prices:
            if rules.restore_when_no_competitors and state.in_round and state.round_original_price is not None:
                return await self._restore_original_price(db, store, product, state)
            return EngineResult(changed=False, reason="no_competitors")

        # 进入本轮调价，记录最初价格
        if not state.in_round:
            state.in_round = True
            state.round_original_price = product.current_price
            state.floor_reached = False

        max_competitor_price = max(competitor_prices)
        if max_competitor_price <= product.current_price:
            return EngineResult(changed=False, reason="not_above_us")

        # 对手价高于我方，按规则降价，且不能突破成本保护与单轮跌幅限制
        next_price = q(product.current_price - rules.price_step)
        floor_by_cost = q(product.cost_price + rules.cost_buffer)
        floor_by_round = q(state.round_original_price * (Decimal("1.0") - Decimal(str(rules.max_round_drop_percent / 100))))
        hard_floor = max(floor_by_cost, floor_by_round)
        if next_price <= hard_floor:
            next_price = hard_floor
            state.floor_reached = True

        if next_price >= product.current_price:
            return EngineResult(changed=False, reason="already_at_floor")

        old_price = product.current_price
        product.current_price = next_price
        await self._emit_event(
            db=db,
            store=store,
            product=product,
            direction="↓",
            old_price=old_price,
            new_price=next_price,
            note="competitor_above_us",
        )
        return EngineResult(changed=True, reason="decrease")

    async def _restore_original_price(
        self,
        db: AsyncSession,
        store: Store,
        product: Product,
        state: RepricingState,
    ) -> EngineResult:
        assert state.round_original_price is not None
        old_price = product.current_price
        restored_price = q(state.round_original_price)

        state.in_round = False
        state.floor_reached = False
        state.round_original_price = None

        if restored_price == old_price:
            return EngineResult(changed=False, reason="already_original")

        product.current_price = restored_price
        await self._emit_event(
            db=db,
            store=store,
            product=product,
            direction="↑",
            old_price=old_price,
            new_price=restored_price,
            note="competitors_left_restore_original",
        )
        return EngineResult(changed=True, reason="restore")

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
