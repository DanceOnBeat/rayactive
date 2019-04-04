# rayactive
一个极其简易版的vuejs实现，仅仅是帮助学习vue的响应式原理。
## 前言
之前项目中一直在用vue，也边做边学摸滚打爬了近一年。对一些基础原理性的东西有过了解，但是不深入，例如面试经常问的vue的响应式原理，可能大多数人都能答出来Object.defineProperty进行数据劫持，但是深入其实现细节，还是有很多之前没考虑到的东西，例如依赖收集后如何通知订阅器，以及订阅发布模式如何实现等等。过程中读了部分源码，受益匪浅，除此之外，动手去实现它也是个很棒的学习方式，话不多说，看代码，[仓库地址](https://github.com/DanceOnBeat/rayactive)。

## 实现
vue的更新机制我们简单概括一下就是，先对template进行解析，若检测到template中使用了data中定义的属性，则生成一个对应的watcher，通过劫持getter进行依赖（即watcher）收集，收集的内容保存在订阅器Dep，通过劫持setter做到改变属性从而通知订阅器更新，那么我们首先要做的就是对属性进行劫持。
vue2.0中使用的是Object.defineProperty，有传言说vue 3.0将会使用Proxy来代替Object.defineProperty，其有诸多好处：
* defineProperty不能对数组进行劫持，因此vue的文档中才会提到只有push、pop等8种方法能够检测变化，而arr[index] = newValue并不能检测变化，push等方法能检测变化也是因为开发者对Array原生方法进行hack实现的。
* defineProperty只能改变对象的某一个属性，若需要劫持整个对象，必须遍历对象，对每个属性劫持，因此效率并不高。而Proxy更像是一个代理，它会产生一个新的对象，该对象内部的属性均以实现劫持。但要注意，某个属性若也是一个对象类型，需要对该属性也执行proxy操作才能实现劫持。

Proxy目前来看唯一的缺点就是兼容性可能存在问题，不过无伤大雅，我们也顺应潮流，使用Proxy来实现数据劫持，代码很简单：
```javascript
/**
 * 接受一个对象，对属性进行依赖追踪
 */
function observable(obj) {
  const dep = new Dep()
  
  const proxy = new Proxy(obj, {
    get(target, property) {
      const value = target[property]
      if (value && typeof value === 'object') { // 若属性为object，递归处理
        target[property] = observable(value)
      }
      if (Dep.target) { // Dep.target指向当前watcher
        dep.addWatcher(Dep.target)
      }
      return target[property]
    },
    set(target, property, value) {
      target[property] = value
      dep.notify() // 通知订阅器
    }
  })
  return proxy
}
```
注意该方法需要返回proxy实例，因为只有通过proxy实例访问属性才具有劫持效果。我们可以看到代码中有一个Dep，这个东西即是订阅器，可以理解为它维护了一个依赖（watcher）的数组，并实现了一些管理数据的方法诸如addWatcher添加依赖，以及需要提供一个notify方法来遍历所有的watcher执行其相应的更新函数，同样代码很简单：
```javascript
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
```
最后我们来看下watcher，我们知道watcher即我们所说的依赖，它是在编译template的时候，若找到data中声明的属性，即会生成一个对应的watcher实例，触发依赖收集，加入订阅器。同时还需要提供一个update函数，在触发notify的时候调用来更新视图，代码如下：
```javascript
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
    if (newValue !== this.value && this.cb) { // 对比property新旧值，决定是否更新
      this.cb(newValue)
    }
  }
  get() { // 只在初始化时调用，用于依赖收集
    Dep.target = this // 将自身指向Dep.target，执行完依赖收集再去释放
    const value = this.proxy[this.property]
    Dep.target = null
    return value
  }
}
```
至此，响应式原理大致已经成形，接着我们只要写一个简易的模板解析，demo就能跑起来啦。我这边的实现比较挫，仅仅是通过正则匹配来实现了一个不带diff的virture dom，纯属娱乐，重点还是在实现响应式原理上，这边贴一下代码：
```javascript
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
```

## 总结
这个简易实现仅仅是帮助大家学习vue的一些原理性的东西，跟vue比其他来只是冰山一角。这个代码还有很大的优化空间，比如执行notify时这里会通知所有的watcher等等，值得有空去研究一下。同时，我们能看到订阅发布模式带来的好处。如果不引入订阅器，那我们更新dom的代码得放到setter中去，那么就耦合了数据劫持与操作dom的逻辑。引入订阅器，能让我们在proxy中仅仅做依赖收集和通知的操作，剩下的各种复杂的或是个性化的逻辑可以放到watcher中去实现，完美做到了关注点分离。




