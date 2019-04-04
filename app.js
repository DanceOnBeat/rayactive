const vm = {
  data: {
    name: 'Ray',
    age: 18
  },
  render: '<div><div>name: {{name}}</div><div>age: {{age}}</div><button @click="handleClick">click</button></div>',
  methods: {
    handleClick() {
      this.name = 'jack'
      this.age = 24
    }
  }
}

new RayActive(vm)