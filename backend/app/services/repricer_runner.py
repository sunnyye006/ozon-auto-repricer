from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.db import SessionLocal
from app.core.security import decrypt_secret
from app.models import Product, RepricingState, Store
from app.services.ozon_client import OzonClient
from app.services.app_settings_service import get_repricing_rules
from app.services.pricing_engine import PricingEngine


class RepricerRunner:
    def __init__(self) -> None:
        self.engine = PricingEngine()

    async def run_once(self) -> None:
        async with SessionLocal() as db:
            rules = await get_repricing_rules(db)
            stores = await db.scalars(
                select(Store)
                .where(Store.is_active.is_(True))
                .options(selectinload(Store.products).selectinload(Product.state))
            )
            for store in stores.all():
                api_key = decrypt_secret(store.api_key_encrypted)
                client = OzonClient(
                    api_base_url=store.api_base_url,
                    client_id=store.client_id,
                    api_key=api_key,
                )
                for product in store.products:
                    if not product.auto_reprice_enabled:
                        continue

                    state = product.state
                    if state is None:
                        state = RepricingState(product_id=product.id)
                        db.add(state)
                        await db.flush()

                    offers = await client.get_competitor_offers(product.ozon_product_id)
                    competitor_prices = [Decimal(str(o["price"])) for o in offers]
                    old_price = product.current_price
                    result = await self.engine.process_product(
                        db=db,
                        store=store,
                        product=product,
                        state=state,
                        competitor_prices=competitor_prices,
                        rules=rules,
                    )

                    if result.changed:
                        # 严格通过 Ozon API 执行真实调价
                        await client.update_price(
                            product.ozon_product_id,
                            product.current_price,
                            offer_id=product.sku,
                        )
                    else:
                        product.current_price = old_price

            await db.commit()


repricer_runner = RepricerRunner()
