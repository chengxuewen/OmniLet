// Task 11 (compile-slice1): wechat facade — dsl-spec §1 门面词表 on the §10 三原语.
// Standard档 = @vue/reactivity (spec §10: 「标准档 = @vue/reactivity 实现三原语」):
//   observe（观察登记）= effect() dependency tracking — every property read made
//           inside the tracked scope registers that path as a subscriber;
//   write（写标脏）    = the reactive() proxy set trap — markDirty + trigger;
//   flush（回合通知） = the microtask batch in adapter.createPage — one setData
//           per tick (Task-1 ruling 「每 tick 一次」), dirty snapshot handed to
//           the Component scheduler.
// The lite档 / container-side Rust trait插档 (spec §10) replace THIS module only;
// author-visible names stay exactly the §1 four words.
export { reactive, ref, computed, watch } from '@vue/reactivity'
// internals consumed by adapter.ts (NOT author vocabulary — dsl-spec §1; the
// emitted require head only binds the names the author actually imports):
export { effect, toRaw } from '@vue/reactivity'
