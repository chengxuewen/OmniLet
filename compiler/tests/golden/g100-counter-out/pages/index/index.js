const { reactive, createPage } = require('../../omnilet-runtime.js')
const state = reactive({
  ready: true,
  count: 0,
  list: ['a', 'b']
});
createPage({
  state,
  methods: {
    inc() {
      state.count++;
    }
  },
  onLoad() {}
});
