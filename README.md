# flclash-rules

自用 FlClash / mihomo 规则集（rule-provider）。放在 GitHub 上由核心按 URL 拉取，脚本里就不用保留本地文件。

| 文件 | 内容 | 引用时给的策略 |
| --- | --- | --- |
| `fcm.yaml` | FCM / Google 推送通道（mtalk、alt1-6、android.clients 等） | `Google` 组（或 `Auto`） |
| `direct.yaml` | 系统连通性检测 + NTP 时间同步 | `DIRECT` |

均为 `behavior: classical`，文件里只写规则、不写目标；目标由配置里 `RULE-SET,名,策略` 那一行决定。

## 用法（贴进 FlClash 的附加规则 / 脚本里）

```yaml
rule-providers:
  MyFCM:
    type: http
    behavior: classical
    url: https://raw.githubusercontent.com/<你的用户名>/flclash-rules/main/fcm.yaml
    path: ./ruleset/my-fcm.yaml
    interval: 86400
  MyDirect:
    type: http
    behavior: classical
    url: https://raw.githubusercontent.com/<你的用户名>/flclash-rules/main/direct.yaml
    path: ./ruleset/my-direct.yaml
    interval: 86400

rules:
  # 广告先拦（用 blackmatrix7 的，291159 条，每天更新，不用自己维护）
  # RULE-SET,MyAds,REJECT
  # 系统直连其次
  - RULE-SET,MyDirect,DIRECT
  # FCM 显式指定（推送要稳就指到 Auto，想省流量就指 Google）
  - RULE-SET,MyFCM,Google
  # ↓ 下面接订阅原有的 RULE-SET 规则
  # - MATCH,Kuromis
```

广告集建议直接用现成的，不要自己攒：

```yaml
rule-providers:
  MyAds:
    type: http
    behavior: classical
    url: https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Advertising/Advertising_Classical.yaml
    path: ./ruleset/Advertising.yaml
    interval: 86400
```

## 注意

- **顺序**：广告 `REJECT` 最前；`MyDirect` 其次；`MyFCM` 在 `MATCH` 之前。`MATCH` 必须最后一行。
- **拉不到**：`raw.githubusercontent.com` 国内常被墙，核心下载 rule-provider 是直连的。给每个 provider 加 `proxy: Auto` 让它走代理下载，或者把 url 换成 jsDelivr 镜像：
  `https://cdn.jsdelivr.net/gh/<你的用户名>/flclash-rules@main/fcm.yaml`
- 仓库必须是 **public**，私有仓库的 raw 链接需要带 token，FlClash 不会替你带。
- 加新规则只改这里再 push，FlClash 下次按 `interval` 自动拉，不用重新导入订阅。
