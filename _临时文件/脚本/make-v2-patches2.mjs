import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = join(HERE, '_分析-智跑校园-v2', 'projects');
const OUT = join(HERE, '易援小程序', '补丁-v2');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const results = [];
const rec = (name, ok, why) => results.push({ name, ok, why });

// ─────────────────────────────────────────────────────────────
// 1. Controller 补 page/pageSize（修 A2：分页契约断裂）
// ─────────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'server', 'src', 'orders', 'orders.controller.ts');
  let t = readFileSync(p, 'utf8');

  const before = `  @Get('available')
  async available(
    @Query('deliveryType') deliveryType = '1',
    @Query('keyword') keyword?: string,
  ) {
    const type = Number(deliveryType);
    if (type !== 1 && type !== 2) throw new BadRequestException('deliveryType 不合法');
    const data = await this.ordersService.listAvailable(type, keyword);
    return { code: 200, msg: 'ok', data };
  }`;

  const after = `  @Get('available')
  async available(
    @Query('deliveryType') deliveryType = '1',
    @Query('keyword') keyword?: string,
    // ★ 修复：原先未接收 page/pageSize，导致：
    //   ① Service 的 page 恒为默认 1，分页失效
    //   ② 前端 setPage(nextPage+1) 递增后被后端忽略 → 上拉加载永远重复第一批
    //   ③ hasMore 基于 res.list.length 判断 → 恰好满页时无限重复加载
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const type = Number(deliveryType);
    if (type !== 1 && type !== 2) throw new BadRequestException('deliveryType 不合法');
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const data = await this.ordersService.listAvailable(type, keyword, p, ps);
    return { code: 200, msg: 'ok', data };
  }`;

  if (t.includes(before)) {
    t = t.replace(before, after);
    writeFileSync(join(OUT, 'orders.controller.ts'), t, 'utf8');
    rec('orders.controller.ts', true, '补 page/pageSize 并透传给 Service（修 A2）');
  } else {
    // 宽松匹配
    const re = /@Get\('available'\)[\s\S]*?return \{ code: 200, msg: 'ok', data \};\s*\n\s*\}/;
    if (re.test(t)) {
      t = t.replace(re, after);
      writeFileSync(join(OUT, 'orders.controller.ts'), t, 'utf8');
      rec('orders.controller.ts', true, '宽松匹配替换成功（修 A2）');
    } else {
      rec('orders.controller.ts', false, '未匹配到 available 方法');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 2. 修错误路由 /pages/login/login → /pages/login/index（修 A4）
// ─────────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'src', 'services', 'request.ts');
  let t = readFileSync(p, 'utf8');
  const bad = "/pages/login/login";
  if (t.includes(bad)) {
    t = t.replace(
      `setTimeout(() => Taro.reLaunch({ url: '/pages/login/login' }), 800)`,
      `// ★ 修复：原路径 /pages/login/login 不存在（实际是 /pages/login/index），
      //   导致 token 失效时跳转失败，用户卡在原页反复报错。
      setTimeout(() => Taro.reLaunch({ url: '/pages/login/index' }), 800)`,
    );
    writeFileSync(join(OUT, 'request.ts'), t, 'utf8');
    rec('src/services/request.ts', true, '修正登录失效跳转路径（修 A4）');
  } else {
    rec('src/services/request.ts', false, '未找到 /pages/login/login');
  }
}

// ─────────────────────────────────────────────────────────────
// 3. credit / order-detail 的 opacity 修正（修 B1 其余处）
// ─────────────────────────────────────────────────────────────
{
  // credit：opacity-85 / opacity-80 用于深色底上的文字 —— 这是可接受的
  //        （在 bg-primary 上让文字略淡，属设计意图），不改。
  // order-detail:197  bg-primary opacity-10 → 图标容器，改为 bg-primary/10
  const p = join(PROJ, 'src', 'pages', 'order-detail', 'index.tsx');
  let t = readFileSync(p, 'utf8');
  const before = 'className="w-10 h-10 rounded-full bg-primary opacity-10 flex items-center justif';
  if (t.includes(before)) {
    t = t.replace(
      /className="w-10 h-10 rounded-full bg-primary opacity-10 flex items-center justify-center([^"]*)"/,
      'className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center$1"',
    );
    writeFileSync(join(OUT, 'order-detail-index.tsx'), t, 'utf8');
    rec('order-detail/index.tsx', true, 'opacity-10 → bg-primary/10（修 B1）');
  } else {
    rec('order-detail/index.tsx', false, '未匹配到 opacity-10 容器');
  }
}

// ─────────────────────────────────────────────────────────────
// 4. publish 页的 opacity-5 提示条（修 B1 最严重处之一）
// ─────────────────────────────────────────────────────────────
{
  const p = join(PROJ, 'src', 'pages', 'publish', 'index.tsx');
  let t = readFileSync(p, 'utf8');
  const before = 'className="flex items-center gap-2 bg-primary opacity-5 rounded-lg px-3 py-2"';
  if (t.includes(before)) {
    t = t.replace(
      before,
      'className="flex items-center gap-2 bg-primary/5 rounded-lg px-3 py-2"',
    );
    writeFileSync(join(OUT, 'publish-index.tsx'), t, 'utf8');
    rec('publish/index.tsx', true, 'opacity-5 → bg-primary/5（修 B1，提示条原本完全不可见）');
  } else {
    rec('publish/index.tsx', false, '未匹配到 opacity-5 提示条');
  }
}

console.log('='.repeat(74));
console.log('补丁生成结果');
console.log('='.repeat(74));
for (const r of results) {
  console.log(`${r.ok ? '[OK]  ' : '[FAIL]'} ${r.name}`);
  console.log(`        ${r.why}`);
}
console.log('\n输出: ' + OUT);
