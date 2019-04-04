let init = false // 只在初始化时去生成watcher
const eventMap = new Map() // 存放事件
const root = document.getElementById('root') // 根节点

/**
 * 用于将传入RayActive的vm对象进行代理，可通过this.xx访问this.data.xx
 * @param {Object} vm 
 * @param {Proxy} proxydata 经过proxy代理的vm.data对象，使this.xx操作也能触发视图更新
 */
function vmProxy(vm, proxydata) {
  return new Proxy(vm, {
    get(target, property) {
      return target.data[property] || target.methods[property]
    },
    set(target, property, value) {
      proxydata[property] = value
    }
  })
}

/**
 * 编译vm，分别对data和render做相应处理
 * @param {Object} vm 需要被编译的vm对象
 */
function compile(vm) {
  const proxydata = compileData(vm.data)
  compileRender(proxydata, vm.render)
  bindEvents(vm, vmProxy(vm, proxydata))
}

/**
 * 
 * @param {Object} data 需要被编译的vm中的data对象
 */
function compileData(data) {
  return observable(data)
}

/**
 * 
 * @param {*} render 需要被编译的render字符串
 * @param {*} proxydata 经proxy转换过的data
 */
function compileRender(proxydata, render) {
  if (render) {
    const variableRegexp = /\{\{(.*?)\}\}/g
    const variableResult = render.replace(variableRegexp, (a, b) => { // 替换变量为相应的data值
      if (!init) { // 只在初始化时去生成watcher
        new Watcher(proxydata, b, function() {
          compileRender(proxydata, render)
        })
      }
      return proxydata[b]
    })
    const eventRegexp = /(?<=<.*)@(.*)="(.*?)"(?=.*>)/
    const result = variableResult.replace(eventRegexp, (a, b, c) => { // 为绑定事件的标签添加唯一id标识
      const id = Math.random().toString(36).slice(2)
      eventMap.set(id, {
        type: b,
        method: c
      })
      return a + ` id=${id}`
    })
    init = true
    root.innerHTML = result
  }
}

/**
 * 通过root节点做事件代理，绑定模板中声明的事件
 * @param {*} vm 
 * @param {*} proxyvm 经过proxy代理的vm
 */
function bindEvents(vm, proxyvm) {
  for (let [key, value] of eventMap) {
    root.addEventListener(value.type, (e) => {
      const method = vm.methods[value.method]
      if (method && e.target.id === key) {
        method.apply(proxyvm) // 将vm中methods方法的this指向经过proxy的vm对象
      }
    })
  }
}

/**
 * 可理解为Vue中的Vue类，使用方式为new RayActive(vm)
 */
class RayActive {
  constructor(vm) {
    compile(vm)
  }
}