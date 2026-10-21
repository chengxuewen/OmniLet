import { reactive } from 'omnilet'
const state = reactive({ ready: true, count: 0, list: ['a','b'] })
export default { state, methods: { inc() { state.count++ } }, onLoad() {} }
