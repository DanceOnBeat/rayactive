/**
 * 接受一个对象，对属性进行依赖追踪
 */
function observable(obj) {
  const dep = new Dep()
  
  const proxy = new Proxy(obj, {
    get(target, property) {
      const value = target[property]
      if (value && typeof value === 'object') { // 递归处理
        target[property] = observable(value)
      }
      if (Dep.target) {
        dep.addWatcher(Dep.target)
      }
      return target[property]
    },
    set(target, property, value) {
      target[property] = value
      dep.notify()
    }
  })
  return proxy
}

/**
 * 依赖收集器，存放所有的watcher，并提供发布功能(notify)
 */
class Dep {
  constructor() {
    this.watchers = []
  }
  addWatcher(watcher) { // 添加watcher
    this.watchers.push(watcher)
  }
  notify() { // 通知方法，调用即依次遍历所有watcher执行更新
    this.watchers.forEach((watcher) => {
      watcher.update()
    })
  }
}

/**
 * watcher即所谓的依赖，监听具体的某个属性
 */
class Watcher {
  constructor(proxy, property, cb) {
    this.proxy = proxy
    this.property = property
    this.cb = cb
    this.value = this.get()
  }
  update() { // 执行更新
    const newValue = this.proxy[this.property]
    if (newValue !== this.value && this.cb) { // 对比property新旧值，决定是否更新
      this.cb(newValue)
    }
  }
  get() { // 只在初始化时调用，用于依赖收集
    Dep.target = this
    const value = this.proxy[this.property]
    Dep.target = null
    return value
  }
}

