// FlClash 覆写脚本 v5：一个数组管所有规则集
// 位置：工具 → 进阶配置 → 脚本（全局），或 订阅详情 → 脚本（单订阅）
// 入口：main(config)。
//
// 每条 { name, url, to } 自动做三件事：
//   1) 在 rule-providers 里补一个 provider（App 里已有同名就沿用你的，不覆盖）
//   2) 在 rules 里插一条 RULE-SET,name,目标
//   3) 跑多少次结果都一样
// 加规则集 = 数组加一行；关掉 = 那行加 off: true；换顺序 = 挪位置。

const ENABLE_ALL = true; // 总开关：false 时脚本什么都不做
const PROVIDER_PROXY = ""; // 下载规则集走哪个组；留空=直连。raw 拉不到时填 "Auto"
const INTERVAL = 86400; // 规则集更新间隔（秒）

// ===== 规则集清单 =====
// name：唯一，App 里手动加的话必须同名
// url ：完整地址，behavior 一律 classical
// to  ：REJECT / DIRECT / 组名（可写关键词，多个用 | 分隔，找不到就退第一个组）
// tail：true = 插在订阅规则最后、MATCH 之前；不写 = 插在最前
const RULESETS = [
  { name: "MyAdsLite", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/AdvertisingLite/AdvertisingLite_Classical_No_Resolve.yaml", to: "REJECT" },
  { name: "MyHijack", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Hijacking/Hijacking_No_Resolve.yaml", to: "REJECT" },
  { name: "MyDirect", url: "https://raw.githubusercontent.com/obmutescenceman-gif/flclash-rules/main/direct.yaml", to: "DIRECT" },
  // FCM 有现成的：blackmatrix7 的 GoogleFCM（15 域名 + 26 IP，共 41 条）
  // 想用我自己写的 15 条，把下一行 url 换成 https://raw.githubusercontent.com/obmutescenceman-gif/flclash-rules/main/fcm.yaml
  { name: "MyFCM", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/GoogleFCM/GoogleFCM_No_Resolve.yaml", to: "FCM|谷歌|Google" },
  { name: "MyChinaIP", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/ChinaIPs/ChinaIPs_Classical_No_Resolve.yaml", to: "DIRECT", tail: true },

  // ===== 按需：去掉行首 // 就生效 =====
  // { name: "MyPrivacy", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Privacy/Privacy_Classical_No_Resolve.yaml", to: "REJECT" },
  // { name: "MyOpenAI", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/OpenAI/OpenAI_No_Resolve.yaml", to: "OpenAI|ChatGPT|AI" },
  // { name: "MyClaude", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Anthropic/Anthropic_No_Resolve.yaml", to: "Claude|Anthropic|AI" },
  // { name: "MySteam", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Steam/Steam_No_Resolve.yaml", to: "Steam|游戏" },
  // { name: "MyYouTube", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/YouTube/YouTube_No_Resolve.yaml", to: "YouTube|谷歌|Google" },
];

// 旧版本脚本用过的名字：升级后清掉，免得规则重复
const CLEAN_RULES = ["MyAds"];
const CLEAN_PROVIDERS = ["MyAds"];

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
  const groups = config["proxy-groups"] || [];
  if (groups.some((g) => String(g.name || "") === t)) return t;
  return pickGroup(config, t.split("|"));
}

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

  // 清掉旧版脚本留下的 provider
  const providers = config["rule-providers"] || {};
  CLEAN_PROVIDERS.forEach((n) => {
    if (providers[n] && !items.some((it) => it.name === n)) delete providers[n];
  });
  config["rule-providers"] = providers;

  if (!items.length) return config;

  const added = items.filter((it) => ensureProvider(config, it)).map((it) => it.name);

  // 先删掉上次插入的同名规则，跑多少次结果都一样
  const names = items
    .map((it) => it.name)
    .concat(CLEAN_RULES)
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
    "rule-providers": { MyAds: { type: "http", behavior: "classical", url: "https://example.com/old.yaml" } },
    rules: ["RULE-SET,MyAds,REJECT", "DOMAIN,example.com,DIRECT", "MATCH,🐟 漏网之鱼"],
    __dshDebug: true,
  };
  const out = main(JSON.parse(JSON.stringify(cfg)));
  const again = main(JSON.parse(JSON.stringify(out)));
  console.log(JSON.stringify({
    providers: Object.keys(out["rule-providers"]),
    oldGone: !out["rule-providers"].MyAds,
    head: out.rules.slice(0, 5),
    tail: out.rules.slice(-3),
    idempotent: JSON.stringify(again.rules) === JSON.stringify(out.rules),
  }, null, 2));
}
