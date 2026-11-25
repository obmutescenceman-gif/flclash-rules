// FlClash 覆写脚本：把 GitHub 上的规则集挂进当前订阅
// 位置：工具 → 进阶配置 → 脚本（全局），或 订阅详情 → 脚本（单订阅）
// 入口：main(config)。脚本只做「结构性」的事，具体域名在 GitHub 上的 fcm.yaml / direct.yaml 里改。

// ===== 可改的开关 =====
const ENABLE_ADS = true; // 广告拦截（blackmatrix7 的 29 万条，REJECT）
const ENABLE_DIRECT = true; // 连通性检测 / NTP 直连
const ENABLE_FCM = true; // FCM 推送走代理组
const FCM_TARGET = ""; // 留空 = 自动找分组（FCM/谷歌/Google），找不到就用第一个组
const PROVIDER_PROXY = ""; // 规则集下载走哪个组；留空 = 直连下载。raw 拉不到时填 "Auto"

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

function main(config) {
  config["rule-providers"] = config["rule-providers"] || {};

  const providers = {};
  if (ENABLE_ADS) providers.MyAds = ADS_URL;
  if (ENABLE_DIRECT) providers.MyDirect = RAW + "direct.yaml";
  if (ENABLE_FCM) providers.MyFCM = RAW + "fcm.yaml";

  for (const name in providers) {
    const p = {
      type: "http",
      behavior: "classical",
      url: providers[name],
      path: "./ruleset/" + name + ".yaml",
      interval: 86400,
    };
    if (PROVIDER_PROXY) p.proxy = PROVIDER_PROXY;
    config["rule-providers"][name] = p;
  }

  // 先删掉上次插入的同名规则，跑多少次结果都一样
  const mine = /^RULE-SET,(MyAds|MyDirect|MyFCM),/i;
  const rules = (config.rules || []).filter((r) => !mine.test(String(r)));
  const notMatch = rules.filter((r) => !/^MATCH,/i.test(String(r)));
  const match = rules.filter((r) => /^MATCH,/i.test(String(r)));

  const fcmGroup = FCM_TARGET || pickGroup(config, ["FCM", "谷歌", "Google", "全球"]);

  const head = [];
  if (ENABLE_ADS) head.push("RULE-SET,MyAds,REJECT");
  if (ENABLE_DIRECT) head.push("RULE-SET,MyDirect,DIRECT");
  if (ENABLE_FCM) head.push("RULE-SET,MyFCM," + fcmGroup);

  // 顺序：广告 → 直连 → FCM → 订阅原有规则 → MATCH 永远最后
  config.rules = head.concat(notMatch).concat(match);
  return config;
}
