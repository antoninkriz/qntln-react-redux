import { getBatch } from './batch'

// encapsulates the subscription logic for connecting a component to the redux store, as
// well as nesting subscriptions of descendant components, so that we can ensure the
// ancestor components re-render before descendants

const nullListeners = { notify() {} }

function createListenerCollection() {
  const batch = getBatch()
  let first = null
  let last = null

  return {
    clear() {
      first = null
      last = null
    },

    notify() {
      batch(() => {
        let listener = first
        while (listener) {
          listener.callback()
          listener = listener.next
        }
      })
    },

    get() {
      let listeners = []
      let listener = first
      while (listener) {
        listeners.push(listener)
        listener = listener.next
      }
      return listeners
    },

    subscribe(callback) {
      let isSubscribed = true

      let listener = (last = {
        callback,
        next: null,
        prev: last,
      })

      if (listener.prev) {
        listener.prev.next = listener
      } else {
        first = listener
      }

      return function unsubscribe() {
        if (!isSubscribed || first === null) return
        isSubscribed = false

        if (listener.next) {
          listener.next.prev = listener.prev
        } else {
          last = listener.prev
        }
        if (listener.prev) {
          listener.prev.next = listener.next
        } else {
          first = listener.next
        }
      }
    },
  }
}

export default class Subscription {
  constructor(
    store,
    parentSub,
    props,
    connectOptions,
    subscribe = 'subscribe'
  ) {
    this.store = store
    this.parentSub = parentSub
    this.unsubscribe = null
    this.listeners = nullListeners
    this.subscribeFuncName = subscribe
    this.props = props
    this.connectOptions = connectOptions
    this.handleChangeWrapper = this.handleChangeWrapper.bind(this)
  }

  addNestedSub(listener) {
    this.trySubscribe()
    return this.listeners.subscribe(listener)
  }

  notifyNestedSubs() {
    this.listeners.notify()
  }

  handleChangeWrapper() {
    if (this.onStateChange) {
      this.onStateChange()
    }
  }

  isSubscribed() {
    return Boolean(this.unsubscribe)
  }

  trySubscribe() {
    if (!this.unsubscribe) {
      // Unlike original react-redux, we treat top-level subscriptions and nested subscriptions the same
      // (we did the same in version 5 of this fork).
      // It could be worth it (performance-wise) to figure out how to make `this.parentSub.addNestedSub(this.handleChangeWrapper)`
      // support the changes in this fork but who knows.
      // If you're brave enough, uncomment the following and have fun.

      // this.unsubscribe = this.parentSub
      // ? this.parentSub.addNestedSub(this.handleChangeWrapper)
      // : this.store[this.subscribeFuncName](
      //     this.handleChangeWrapper,
      //     this.props,
      //     this.connectOptions
      //   )

      this.unsubscribe = this.store[this.subscribeFuncName](
        this.handleChangeWrapper,
        this.props,
        this.connectOptions
      )

      this.listeners = createListenerCollection()
    }
  }

  tryUnsubscribe() {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
      this.listeners.clear()
      this.listeners = nullListeners
    }
  }
}
