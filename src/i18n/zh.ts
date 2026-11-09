export const zh = {
  siteName: "aisubscr",
  nav: {
    home: "首页",
    products: "商品",
    subscribe: "订阅",
    blog: "博客",
    account: "个人中心",
    cart: "购物车",
    orders: "我的订单",
    tickets: "售后工单",
    admin: "管理后台",
    login: "登录",
    register: "注册",
    logout: "退出",
  },
  common: {
    loading: "加载中…",
    save: "保存",
    cancel: "取消",
    submit: "提交",
    back: "返回",
    exampleData: "示例数据",
    mockPay: "模拟支付",
    currency: "¥",
    search: "搜索文章",
    theme: "主题",
    themeSystem: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色",
    language: "语言",
  },
  auth: {
    email: "邮箱",
    password: "密码",
    name: "昵称",
    loginTitle: "登录",
    registerTitle: "注册账号",
    noAccount: "还没有账号？去注册",
    hasAccount: "已有账号？去登录",
  },
  product: {
    listTitle: "商品 / 订阅",
    detail: "商品详情",
    addToCart: "加入购物车",
    buyNow: "立即购买",
    subscription: "可按月续费",
    price: "价格",
  },
  cart: {
    title: "购物车",
    empty: "购物车是空的",
    checkout: "去结算",
    quantity: "数量",
    remove: "移除",
  },
  order: {
    title: "订单",
    history: "我的订单",
    status: {
      PENDING: "待支付",
      PAID: "已支付",
      COMPLETED: "已完成",
      REFUNDED: "已退款",
    },
    timeline: {
      created: "已下单",
      pending: "待支付",
      paid: "已支付",
      completed: "已完成",
    },
    pay: "去支付",
    renew: "续费一个月",
    createTicket: "提交售后",
    shareHint: "可通过此链接分享订单状态（无需登录）",
  },
  payment: {
    title: "选择支付方式",
    wechat: "微信支付",
    alipay: "支付宝",
    mock: "模拟支付（本地预览）",
    mockNote: "当前为 MOCK 支付提供商，不会产生真实扣款。正式接入需商户凭证。",
    success: "支付成功",
  },
  ticket: {
    title: "售后工单",
    subject: "主题",
    body: "问题描述",
    reply: "回复",
    status: { OPEN: "待处理", REPLIED: "已回复", CLOSED: "已关闭" },
    fab: "联系客服",
    fabHint: "登录后可对订单提交售后工单；也可先发送邮件。",
  },
  blog: {
    title: "博客",
    empty: "暂无文章",
    readMore: "阅读全文",
    recent: "最近要点",
    categories: "分类导航",
    searchPlaceholder: "搜索文章：如 示例、续费、支付…",
  },
  home: {
    headline: "通用数字商品商城框架",
    description:
      "本地演示注册登录、商品订阅、模拟支付、订单分享与售后。商品与文章均为示例数据，便于后续换肤与接入真实业务。",
    ctaProducts: "浏览商品",
    ctaBlog: "阅读博客",
    highlightsUpdated: "最近要点",
  },
  footer: {
    faq: "常见问题",
    guides: "使用指南",
    products: "商品",
    blog: "博客",
    rss: "RSS",
    account: "个人中心",
    support: "售后支持",
    disclaimer:
      "本站为通用数字商品电商演示框架。页面中的商品、文章与支付均为示例 / 模拟数据，不涉及任何第三方账号创建、转卖或交付。品牌名称如有出现仅为占位，与其权利方无关联。",
  },
  admin: {
    title: "管理后台",
    products: "商品管理",
    orders: "订单管理",
    tickets: "工单管理",
    blog: "文章管理",
    settings: "站点设置",
    markRefund: "标记退款",
    markCompleted: "标记完成",
  },
  support: {
    email: "客服邮箱",
    hours: "服务时间",
  },
} as const;

type WidenStrings<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? WidenStrings<U>[]
    : T extends object
      ? { [K in keyof T]: WidenStrings<T[K]> }
      : T;

/** Same keys as `zh`, with string values widened so other locales can differ. */
export type Dict = WidenStrings<typeof zh>;
