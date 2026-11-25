// FlClash 覆写脚本：把 GitHub 上的规则集挂进当前订阅
// 位置：工具 → 进阶配置 → 脚本（全局），或 订阅详情 → 脚本（单订阅）
// 入口：main(config)。
//
// 两种用法都能配合：
//   A. App 里手动加了同名规则集（MyAds / MyDirect / MyFCM）→ 脚本直接沿用你加的，不覆盖 URL
//   B. App 里没加 → 脚本自动补上 provider 定义
// 脚本只负责：保证 provider 存在、把三条 RULE-SET 插到最前、MATCH 收尾、跑多次结果一致。

// ===== 可改的开关 =====
const ENABLE_ADS = true; // 广告拦截（blackmatrix7 的 29 万条，REJECT）
const ENABLE_DIRECT = true; // 连通性检测 / NTP 直连
const ENABLE_FCM = true; // FCM 推送走代理组
const FCM_TARGET = ""; // 留空 = 自动找分组（FCM/谷歌/Google），找不到就用第一个组
const PROVIDER_PROXY = ""; // 新建 provider 时下载走哪个组；留空 = 直连。raw 拉不到时填 "Auto"

// 规则集名字：App 里手动加的话必须用这三个名字（大小写一致）
const NAME_ADS = "MyAds";
const NAME_DIRECT = "MyDirect";
const NAME_FCM = "MyFCM";

const RAW = "https://raw.githubusercontent.com/obmutescenceman-gif/flclash-rules/main/";
// jsDelivr 镜像：raw 被墙时把 RAW 换成这行
// const RAW = "https://cdn.jsdelivr.net/gh/obmutescenceman-gif/flclash-rules@main/";
const ADS_URL =
  "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Advertising/Advertising_Classical.yaml";

function pickGroup(config, patterns) {
  const groups = config["proxy-groups"] || [];
  for (const p of patterns) {
    const re = new RegExp(p, "i");
    const hit = groups.find((g) => re.test(String(g.name || "")));
    if (hit) return hit.name;
  }
  if (groups.length) return String(groups[0].name);
  return "DIRECT";
}

// 已有同名 provider 就保留（App 里加的就用你的），没有再补
function ensureProvider(config, name, url) {
  config["rule-providers"] = config["rule-providers"] || {};
  if (config["rule-providers"][name]) return false;
  const p = {
    type: "http",
    behavior: "classical",
    url: url,
    path: "./ruleset/" + name + ".yaml",
    interval: 86400,
  };
  if (PROVIDER_PROXY) p.proxy = PROVIDER_PROXY;
  config["rule-providers"][name] = p;
  return true;
}

function main(config) {
  const added = [];
  if (ENABLE_ADS && ensureProvider(config, NAME_ADS, ADS_URL)) added.push(NAME_ADS);
  if (ENABLE_DIRECT && ensureProvider(config, NAME_DIRECT, RAW + "direct.yaml")) added.push(NAME_DIRECT);
  if (ENABLE_FCM && ensureProvider(config, NAME_FCM, RAW + "fcm.yaml")) added.push(NAME_FCM);

  // 先删掉上次插入的同名规则，跑多少次结果都一样
  const mine = new RegExp("^RULE-SET,(" + [NAME_ADS, NAME_DIRECT, NAME_FCM].join("|") + "),", "i");
  const rules = (config.rules || []).filter((r) => !mine.test(String(r)));
  const notMatch = rules.filter((r) => !/^MATCH,/i.test(String(r)));
  const match = rules.filter((r) => /^MATCH,/i.test(String(r)));

  const fcmGroup = FCM_TARGET || pickGroup(config, ["FCM", "谷歌", "Google", "全球"]);

  const head = [];
  if (ENABLE_ADS) head.push("RULE-SET," + NAME_ADS + ",REJECT");
  if (ENABLE_DIRECT) head.push("RULE-SET," + NAME_DIRECT + ",DIRECT");
  if (ENABLE_FCM) head.push("RULE-SET," + NAME_FCM + "," + fcmGroup);

  // 顺序：广告 → 直连 → FCM → 订阅原有规则 → MATCH 永远最后
  config.rules = head.concat(notMatch).concat(match);
  if (config.__dshDebug) config.__addedProviders = added;
  return config;
}
