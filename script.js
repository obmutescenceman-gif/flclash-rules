// FlClash 覆写脚本 v6：跟着 App 里已有的规则集走
// 位置：工具 → 进阶配置 → 脚本（全局），或 订阅详情 → 脚本（单订阅）
// 入口：main(config)。
//
// 核心逻辑：按 URL 认规则集。
//   - App 规则集页里已经有同一个 URL → 沿用你的名字和定义，不重复添加
//   - 没有 → 脚本自己补一个定义（behavior: classical）
//   - 然后把 RULE-SET 插进 rules，跑多少次都一样
//
// 加规则集 = RULESETS 加一行；关掉 = 那行加 off: true

const ENABLE_ALL = true; // 总开关
const PROVIDER_PROXY = ""; // 下载规则集走哪个组；留空=直连。raw 拉不到时填 "Auto"
const INTERVAL = 86400; // 规则集更新间隔（秒）

// ===== 规则集清单 =====
// url ：完整地址，behavior 必须 classical
// to  ：REJECT / DIRECT / 组名（可写关键词，多个用 | 分隔，找不到就退第一个组）
// tail：true = 插在订阅规则最后、MATCH 之前；不写 = 插在最前
const RULESETS = [
  // 广告/追踪域名 → 拦掉（38,066 条，1.1 MB）。不要用全量 Advertising（291,159 条），太重且误杀多
  { name: "AdvertisingLite_Classical_No_Resolve", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/AdvertisingLite/AdvertisingLite_Classical_No_Resolve.yaml", to: "REJECT" },
  // 劫持/运营商推广/短链跳转 → 拦掉（228 条，很轻）
  { name: "Hijacking_No_Resolve", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Hijacking/Hijacking_No_Resolve.yaml", to: "REJECT" },
  // 系统连通性检测 + NTP（16 条，自写）→ 必须直连，否则 WiFi 提示无网络、时间乱跳
  { name: "direct", url: "https://raw.githubusercontent.com/obmutescenceman-gif/flclash-rules/main/direct.yaml", to: "DIRECT" },
  // FCM 推送通道（41 条）→ 指向订阅里的 FCM/谷歌组；不要同时再挂自写的 fcm.yaml，两套会重复
  { name: "GoogleFCM_No_Resolve", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/GoogleFCM/GoogleFCM_No_Resolve.yaml", to: "FCM|谷歌|Google" },
  // 国内 IP 段（19,619 条）→ 放最后直连，代替 GEOIP,CN；订阅里已有 GEOIP,CN 就加 off: true
  { name: "ChinaIPs_Classical_No_Resolve", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/ChinaIPs/ChinaIPs_Classical_No_Resolve.yaml", to: "DIRECT", tail: true },

  // ===== 按需：去掉行首 // 就生效 =====
  // 隐私追踪（39,936 条，误杀风险最高）
  // { name: "Privacy_Classical_No_Resolve", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Privacy/Privacy_Classical_No_Resolve.yaml", to: "REJECT" },
  // OpenAI（35 条）→ 固定走某地区，避免风控
  // { name: "OpenAI_No_Resolve", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/OpenAI/OpenAI_No_Resolve.yaml", to: "OpenAI|ChatGPT|AI" },
  // Claude（3 条）
  // { name: "Anthropic_No_Resolve", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Anthropic/Anthropic_No_Resolve.yaml", to: "Claude|Anthropic|AI" },
  // Steam（69 条）
  // { name: "Steam_No_Resolve", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Steam/Steam_No_Resolve.yaml", to: "Steam|游戏" },
  // YouTube（183 条）
  // { name: "YouTube_No_Resolve", url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/YouTube/YouTube_No_Resolve.yaml", to: "YouTube|谷歌|Google" },
];

// 旧脚本用过的名字：清掉它们的 RULE-SET 引用，免得重复
const OLD_NAMES = ["MyAds", "MyAdsLite", "MyHijack", "MyDirect", "MyFCM", "MyChinaIP"];

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

// 按 URL 找已有 provider；找不到再用 name，最后才新建
function resolveProviders(config, items, added) {
  const rp = (config["rule-providers"] = config["rule-providers"] || {});
  const used = new Set(Object.keys(rp));
  return items.map((it) => {
    const byUrl = Object.keys(rp).find((k) => String((rp[k] || {}).url || "") === it.url);
    const byName = Object.keys(rp).find((k) => k === it.name);
    let key = byUrl || byName;
    if (!key) {
      key = it.name;
      let n = 2;
      while (used.has(key)) key = it.name + "_" + n++;
      const def = {
        type: "http",
        behavior: "classical",
        url: it.url,
        path: "./ruleset/" + key + ".yaml",
        interval: it.interval || INTERVAL,
      };
      if (PROVIDER_PROXY) def.proxy = PROVIDER_PROXY;
      rp[key] = def;
      used.add(key);
      added.push(key);
    }
    return Object.assign({}, it, { key: key });
  });
}

function main(config) {
  if (!ENABLE_ALL) return config;

  const items = RULESETS.filter((r) => r && r.name && r.url && !r.off);
  if (!items.length) return config;

  const added = [];
  const resolved = resolveProviders(config, items, added);
  const keep = {};
  resolved.forEach((r) => (keep[r.key] = true));

  // 删掉上次插的 RULE-SET（按当前名字 + 旧名字），保证幂等
  const drop = {};
  Object.keys(keep).forEach((k) => (drop[k] = true));
  OLD_NAMES.forEach((n) => (drop[n] = true));
  const kept = (config.rules || []).filter((line) => {
    const m = /^RULE-SET,([^,]+),/i.exec(String(line));
    if (!m) return true;
    return !drop[m[1].trim()];
  });

  const head = [];
  const tail = [];
  resolved.forEach((it) => {
    const line = "RULE-SET," + it.key + "," + targetOf(config, it.to);
    (it.tail ? tail : head).push(line);
  });

  // 顺序：头部规则 → 订阅原有规则 → 尾部规则 → MATCH（全部挪到最后）
  const rest = kept.filter((r) => !/^MATCH,/i.test(String(r)));
  const match = kept.filter((r) => /^MATCH,/i.test(String(r)));
  config.rules = head.concat(rest).concat(tail).concat(match);

  if (config.__dshDebug) {
    config.__addedProviders = added;
    config.__rulesets = resolved.map((r) => r.key);
  }
  return config;
}

// Node 本地测试：node flclash-script.js
if (typeof module !== "undefined" && require.main === module) {
  const cfg = {
    "proxy-groups": [{ name: "🚀 节点选择" }, { name: "🔯 谷歌FCM" }, { name: "🐟 漏网之鱼" }],
    "rule-providers": {
      AdvertisingLite_Classical_No_Resolve: { type: "http", behavior: "classical", url: RULESETS[0].url },
      direct: { type: "http", behavior: "classical", url: RULESETS[2].url },
      Hijacking_No_Resolve: { type: "http", behavior: "classical", url: RULESETS[1].url },
      GoogleFCM_No_Resolve: { type: "http", behavior: "classical", url: RULESETS[3].url },
      ChinaIPs_Classical_No_Resolve: { type: "http", behavior: "classical", url: RULESETS[4].url },
      MyAds: { type: "http", behavior: "classical", url: "https://example.com/old.yaml" },
    },
    rules: ["RULE-SET,MyAds,REJECT", "RULE-SET,MyFCM,🔯 谷歌FCM", "DOMAIN,example.com,DIRECT", "MATCH,🐟 漏网之鱼"],
    __dshDebug: true,
  };
  const out = main(JSON.parse(JSON.stringify(cfg)));
  const again = main(JSON.parse(JSON.stringify(out)));
  console.log(JSON.stringify({
    providers: Object.keys(out["rule-providers"]),
    addedProviders: out.__addedProviders,
    rules: out.rules,
    idempotent: JSON.stringify(again.rules) === JSON.stringify(out.rules),
  }, null, 2));
}
