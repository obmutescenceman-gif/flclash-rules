// FlClash 覆写脚本 v4：规则集清单驱动
// 位置：工具 → 进阶配置 → 脚本（全局），或 订阅详情 → 脚本（单订阅）
// 入口：main(config)。
//
// 一个数组管到底：每条 { name, url, to } 会自动
//   1) 在 rule-providers 里补一个 provider（App 里已有同名就沿用你的，不覆盖 URL）
//   2) 在 rules 里插一条 RULE-SET,name,目标
//   3) 跑多少次结果都一样（先删自己上次插的，再插）
// 想加规则集 = 数组里加一行；想关 = 那行加 off: true；想换顺序 = 挪位置。

// ===== 全局开关 =====
const ENABLE_ALL = true; // 总开关：false 时脚本什么都不做
const PROVIDER_PROXY = ""; // 新建 provider 下载走哪个组；留空=直连。raw 拉不到就填 "Auto"
const INTERVAL = 86400; // 规则集更新间隔（秒）

const RAW = "https://raw.githubusercontent.com/obmutescenceman-gif/flclash-rules/main/";
// jsDelivr 镜像：raw 被墙时把 RAW 换成这行
// const RAW = "https://cdn.jsdelivr.net/gh/obmutescenceman-gif/flclash-rules@main/";
const BM = "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/";

// ===== 规则集清单 =====
// name：必须唯一；App 里手动加的话用同名（大小写一致）
// url ：规则集地址（behavior 一律 classical）
// to  ：REJECT / DIRECT / 组名关键词（多个用 | 分隔，找不到就退第一个组）
// tail：true = 插在订阅规则最后、MATCH 之前；不写 = 插在最前
const RULESETS = [
  // 广告：先用 Lite（误杀少），不够再换掉下面这行的 url
  { name: "MyAdsLite", url: BM + "Advertising/AdvertisingLite_Classical_No_Resolve.yaml", to: "REJECT" },
  // 广告联盟跳转、域名劫持
  { name: "MyHijack", url: BM + "Hijacking/Hijacking_No_Resolve.yaml", to: "REJECT" },
  // 自建：连通性检测 + NTP 直连
  { name: "MyDirect", url: RAW + "direct.yaml", to: "DIRECT" },
  // FCM 推送：要更全就用官方 GoogleFCM 清单（把 url 换成下一行）
  { name: "MyFCM", url: RAW + "fcm.yaml", to: "FCM|谷歌|Google" },
  // { name: "MyFCM", url: BM + "GoogleFCM/GoogleFCM_No_Resolve.yaml", to: "FCM|谷歌|Google" },
  // 国内 IP 兜底直连（替代 GEOIP,CN）：放最后
  { name: "MyChinaIP", url: BM + "ChinaIPs/ChinaIPs_Classical_No_Resolve.yaml", to: "DIRECT", tail: true },

  // ===== 按需打开 =====
  // { name: "MyPrivacy", url: BM + "Privacy/Privacy_Classical_No_Resolve.yaml", to: "REJECT" },
  // { name: "MyOpenAI",  url: BM + "OpenAI/OpenAI_No_Resolve.yaml",     to: "OpenAI|ChatGPT|AI" },
  // { name: "MyClaude",  url: BM + "Anthropic/Anthropic_No_Resolve.yaml", to: "Claude|Anthropic|AI" },
  // { name: "MySteam",   url: BM + "Steam/Steam_No_Resolve.yaml",       to: "Steam|游戏" },
  // { name: "MyYouTube", url: BM + "YouTube/YouTube_No_Resolve.yaml",   to: "YouTube|谷歌|Google" },
];

function pickGroup(config, patterns) {
  const groups = config["proxy-groups"] || [];
  for (const p of patterns) {
    const re = new RegExp(p, "i");
    const hit = groups.find((g) => re.test(String(g.name || "")));
    if (hit) return String(hit.name);
  }
  if (groups.length) return String(groups[0].name);
  return "DIRECT";
}

function targetOf(config, to) {
  const t = String(to || "").trim();
  if (/^(REJECT|REJECT-DROP|DIRECT|PASS)$/i.test(t)) return t.toUpperCase();
  // 先看有没有完全同名的组
  const groups = config["proxy-groups"] || [];
  const exact = groups.find((g) => String(g.name || "") === t);
  if (exact) return t;
  return pickGroup(config, t.split("|"));
}

// 已有同名 provider 就保留（App 里加的就用你的），没有再补
function ensureProvider(config, item) {
  config["rule-providers"] = config["rule-providers"] || {};
  if (config["rule-providers"][item.name]) return false;
  const p = {
    type: "http",
    behavior: "classical",
    url: item.url,
    path: "./ruleset/" + item.name + ".yaml",
    interval: item.interval || INTERVAL,
  };
  if (PROVIDER_PROXY) p.proxy = PROVIDER_PROXY;
  config["rule-providers"][item.name] = p;
  return true;
}

function main(config) {
  if (!ENABLE_ALL) return config;

  const items = RULESETS.filter((r) => r && r.name && r.url && !r.off);
  if (!items.length) return config;

  const added = items.filter((it) => ensureProvider(config, it)).map((it) => it.name);

  // 先删掉上次插入的同名规则，跑多少次结果都一样
  // CLEAN：旧版本脚本用过的名字，升级后清掉，免得广告规则重复
  const CLEAN = ["MyAds"];
  const names = items
    .map((it) => it.name)
    .concat(CLEAN)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const mine = new RegExp("^RULE-SET,(" + names.join("|") + "),", "i");
  const kept = (config.rules || []).filter((r) => !mine.test(String(r)));

  const head = [];
  const tail = [];
  items.forEach((it) => {
    const line = "RULE-SET," + it.name + "," + targetOf(config, it.to);
    (it.tail ? tail : head).push(line);
  });

  // 顺序：头部规则 → 订阅原有规则 → 尾部规则 → MATCH（全部挪到最后）
  const rest = kept.filter((r) => !/^MATCH,/i.test(String(r)));
  const match = kept.filter((r) => /^MATCH,/i.test(String(r)));
  config.rules = head.concat(rest).concat(tail).concat(match);

  if (config.__dshDebug) {
    config.__addedProviders = added;
    config.__rulesets = items.map((it) => it.name);
  }
  return config;
}

// Node 本地测试：node flclash-script.js
if (typeof module !== "undefined" && require.main === module) {
  const cfg = {
    "proxy-groups": [{ name: "🚀 节点选择" }, { name: "🔯 谷歌FCM" }, { name: "🐟 漏网之鱼" }],
    rules: ["DOMAIN,example.com,DIRECT", "MATCH,🐟 漏网之鱼"],
    __dshDebug: true,
  };
  const out = JSON.parse(JSON.stringify(main(JSON.parse(JSON.stringify(cfg)))));
  const again = main(JSON.parse(JSON.stringify(out)));
  console.log(JSON.stringify({
    providers: Object.keys(out["rule-providers"] || {}),
    head: out.rules.slice(0, 5),
    tail: out.rules.slice(-4),
    newProviders: out.__addedProviders,
    idempotent: JSON.stringify(again.rules) === JSON.stringify(out.rules),
  }, null, 2));
}
