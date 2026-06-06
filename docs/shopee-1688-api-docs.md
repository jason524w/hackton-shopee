# Shopee 和 1688 API 文档入口

## Shopee

| 类型 | 文档入口 | 主要用途 |
| --- | --- | --- |
| Shopee Affiliate API | [Shopee SG Help: API Access](https://help.shopee.sg/10/article/191702-API-Access) | 联盟营销 API，包括商品 offer、品牌 offer、短链、转化报表、佣金相关能力 |
| Shopee Open Platform | [Shopee Open Platform](https://open.shopee.com/) | 卖家/ERP 类 API，包括商品、订单、库存、物流、店铺授权等能力 |
| Shopee Open Platform Docs | [Shopee API Documents](https://open.shopee.com/documents) | 具体接口文档入口，例如 product、order、logistics、shop、media 等模块 |

### 使用建议

- 做推广、联盟、佣金、短链：看 Shopee Affiliate API。
- 做店铺运营、上传商品、订单同步、库存管理：看 Shopee Open Platform。
- 开店、资质审核、绑定收款等流程通常不能直接通过 API 完成，需要在 Shopee Seller Center 或官方流程中操作。

## 1688

| 类型 | 文档入口 | 主要用途 |
| --- | --- | --- |
| 1688 开放平台 | [阿里巴巴开放平台](https://aop.alibaba.com/) | 1688 官方开放平台首页 |
| 1688 技术文档/API 分类 | [open.1688.com 技术文档](https://open.1688.com/) | 商品、旺铺、订单、支付、物流、会员等 API 能力 |
| 1688 控制中心 | [1688 开放平台控制中心](https://open.1688.com/) | 创建应用、申请权限、获取 App Key/App Secret、配置 OAuth 授权 |

### 使用建议

- 做采购、选品、铺货、下单、物流同步：看 1688 开放平台。
- 获取商品详情、供应商信息、订单、物流等：通常需要创建应用并申请对应接口权限。
- 开 1688 店铺、企业认证、资质审核等流程通常不能直接通过 API 完成，需要走平台官方入驻流程。

## 快速对比

| 需求 | Shopee | 1688 |
| --- | --- | --- |
| 商品推广/佣金 | Shopee Affiliate API | 非主要场景 |
| 上传或管理自有店铺商品 | Shopee Open Platform | 供应商侧可能有商品管理能力，需申请权限 |
| 获取自己店铺订单 | Shopee Open Platform | 1688 开放平台订单接口 |
| 获取商品详情 | Affiliate API 可获取推广商品；Open Platform 可获取授权店铺商品 | 1688 开放平台商品接口，例如 `alibaba.product.get` |
| 批量采购/代发 | 非 Shopee 主场景 | 1688 核心场景之一 |
| 创建采购订单 | 不适用或需按具体业务系统处理 | 1688 开放平台订单接口 |
| 开店 | 通常不能通过 API 完成 | 通常不能通过 API 完成 |
| 官方 MCP | 暂未看到官方 MCP | 暂未看到官方 MCP |

## MCP 判断

- Shopee：目前能找到社区 MCP，但没有看到 Shopee 官方 MCP。
- 1688：目前能找到部分 1688/dropshipping/爬虫相关项目，以及第三方 MCP/自动化工具，但没有看到 1688 官方 MCP。
- 如果要做 AI Agent 或 MCP，建议直接基于官方 API 封装自己的 MCP tools，避免依赖不明第三方 scraper。
