# flclash-rules

自用 FlClash / mihomo 规则集（rule-provider）+ 覆写脚本。清单放这里，配置里只引用 URL，换设备不用带文件。

| 文件 | 内容 | 引用时给的策略 |
| --- | --- | --- |
| `fcm.yaml` | FCM / Google 推送通道（mtalk、alt1-6-mtalk、android.clients、firebaseinstallations 等 15 条） | 走代理组（Google / FCM 组） |
| `direct.yaml` | 系统连通性检测 + NTP 时间同步（16 条） | `DIRECT` |
| `script.js` | 覆写脚本：声明 provider、插 RULE-SET、保幂等、MATCH 收尾 | — |

均为 `behavior: classical`，文件里只写规则、不写目标；目标由配置里 `RULE-SET,名,策略` 那一行决定。

## 用法一：覆写脚本（推荐）

把 `script.js` 贴进 FlClash 的 工具 → 进阶配置 → 脚本，或 订阅详情 → 脚本。它会自动：

1. 声明三个 provider：`MyAds`（blackmatrix7 广告集，29 万条，REJECT）、`MyDirect`、`MyFCM`
2. 自动找 FCM 组：名字含 FCM / 谷歌 / Google 的分组，找不到就用第一个分组
3. 把三条 `RULE-SET` 插到规则最前面，`MATCH` 永远保在最后
4. 跑多次结果一致（先删自己上次插的，再插）

顶部开关：

```js
const ENABLE_ADS = true;   // 广告拦截
const ENABLE_DIRECT = true;
const ENABLE_FCM = true;
const FCM_TARGET = "";     // 留空自动找组，或写死组名
const PROVIDER_PROXY = ""; // 规则集下载走哪个组；raw 拉不到时填 "Auto"
```

广告拦了不该拦的（登录页、小程序），把 `ENABLE_ADS` 关掉即可。

## 用法二：手动贴规则

```yaml
rule-providers:
  MyFCM:
    type: http
    behavior: classical
    url: https://raw.githubusercontent.com/obmutescenceman-gif/flclash-rules/main/fcm.yaml
    path: ./ruleset/my-fcm.yaml
    interval: 86400
  MyDirect:
    type: http
    behavior: classical
    url: https://raw.githubusercontent.com/obmutescenceman-gif/flclash-rules/main/direct.yaml
    path: ./ruleset/my-direct.yaml
    interval: 86400

rules:
  - RULE-SET,MyDirect,DIRECT
  - RULE-SET,MyFCM,Google
  # ↓ 接订阅原有规则，MATCH 必须在最后
```

## 注意

- **顺序**：广告 `REJECT` 最前；`MyDirect` 其次；`MyFCM` 在 `MATCH` 之前；`MATCH` 必须最后一行。
- **拉不到**：`raw.githubusercontent.com` 国内常被墙，核心下载 rule-provider 是直连的。给 provider 加 `proxy: Auto` 走代理下载，或换 jsDelivr 镜像：
  `https://cdn.jsdelivr.net/gh/obmutescenceman-gif/flclash-rules@main/fcm.yaml`
- 仓库必须 **public**，私有仓库的 raw 链接要带 token，FlClash 不会替你带。
- 加新规则只改 yaml 再 push，FlClash 按 `interval` 自动拉，不用重新导入订阅。
- FCM 在多数订阅里早被 Google 规则集的 `DOMAIN-SUFFIX,google.com` 覆盖了，这里显式写是为了固定走哪个组、不被订阅改乱。
