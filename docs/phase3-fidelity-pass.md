# Follow-up fidelity pass — Thai merchant-app direction

## What moved closer to the references

The supplied newer Home screenshot places store context above two operational highlights, followed by a tailored recommendation and a dense shortcut grid. The prototype now follows that hierarchy with backend-backed completed orders and GMV. It does not show a “preparing” count, store status, notifications, payments, or branch switching because the current backend has no corresponding data or action.

The navigation and static operational labels now use Thai terms matching [GrabMerchant's Thai getting-started guide](https://merchant.grab.com/th-th/guides/all/download-app): หน้าแรก, คำสั่งซื้อ, เมนู, and ข้อมูลเชิงลึก. The new One Click capability keeps its own name so it is not confused with GrabMerchant's existing AI Assistant. [GrabMerchant's Thai Insights help](https://help.grab.com/merchant/th-th/4414717693209-%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%B9%E0%B8%A5%E0%B9%80%E0%B8%8A%E0%B8%B4%E0%B8%87%E0%B8%A5%E0%B8%B6%E0%B8%81%E0%B8%9A%E0%B8%99%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B8%AF-%E0%B9%81%E0%B8%A5%E0%B8%B0%E0%B8%9E%E0%B8%AD%E0%B8%A3%E0%B9%8C%E0%B8%97%E0%B8%B1%E0%B8%A5-GrabMerchant-%E0%B8%84%E0%B8%B7%E0%B8%AD%E0%B8%AD%E0%B8%B0%E0%B9%84%E0%B8%A3) informed the period and sales terminology.

The Home highlights, recommendation, shortcut grid, section rows, Thai labels, and font sizes are defined in [fidelity.css](../frontend/app/fidelity.css). Original icon components and CSS form every visible element; no Grab screenshot, logo artwork, or proprietary asset is embedded.

## Screenshots at 390 × 844

- [Home](screenshots/fidelity/home-390.png)
- [Orders](screenshots/fidelity/orders-390.png)
- [Menu](screenshots/fidelity/menu-390.png)
- [Insights](screenshots/fidelity/insights-390.png)
- [One Click](screenshots/fidelity/ai-390.png)
- [Mission review](screenshots/fidelity/review-390.png)

The previous [Checkpoint A.1 captures](screenshots/checkpoint-a1/before/) provide the before comparison. The proposed mission screenshots use an isolated seeded preview; the main merchant's completed mission remains untouched.

## Verification and limits

The production build passed. The read-only visual check passed at 320, 375, 390, and 430 CSS pixels across six routes, keyboard skip link and account control, cost validation, explicit approval gating, bottom-scroll visibility, and no horizontal overflow. The full simulated journey passed on the isolated preview: edited cost → backend revision and comparison → explicit approval → simulated outcome → persisted review. The preview was reseeded afterward. The browser still does not calculate authoritative financial values.

This remains an unofficial concept, not a replica of any single GrabMerchant version. Different markets and app versions show different layouts. The backend lacks live order handling, store status, notifications, multi-branch data, payments, and menu publishing; those controls are not fabricated. Merchant-entered names and generated mission copy from the synthetic backend remain in English where the source data is English.
