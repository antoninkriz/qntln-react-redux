import { getBatch } from './batch'

// encapsulates the subscription logic for connecting a component to the redux store, as
// well as nesting subscriptions of descendant components, so that we can ensure the
// ancestor components re-render before descendants

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

const nullListeners = {
  notify() {},
  get: () => [],
}


export function createSubscription(
  store,
  parentSub,
  props,
  connectOptions,
  subscribe = 'subscribe'
) {
  let unsubscribe
  let listeners = nullListeners

  function addNestedSub(listener) {
    trySubscribe()
    return listeners.subscribe(listener)
  }

  function notifyNestedSubs() {
    listeners.notify()
  }

  function handleChangeWrapper() {
    if (subscription.onStateChange) {
      subscription.onStateChange()
    }
  }

  function isSubscribed() {
    return Boolean(unsubscribe)
  }

  function trySubscribe() {
    if (!unsubscribe) {
      // Unlike original react-redux, we treat top-level subscriptions and nested subscriptions the same
      // (we did the same in version 5 of this fork).
      // It could be worth it (performance-wise) to figure out how to make `this.parentSub.addNestedSub(this.handleChangeWrapper)`
      // support the changes in this fork but who knows.
      // If you're brave enough, uncomment the following and have fun.

      // unsubscribe = parentSub
      // ? parentSub.addNestedSub(handleChangeWrapper)
      // : store[subscribe](
      //     handleChangeWrapper,
      //     props,
      //     connectOptions
      //   )

      unsubscribe = store[subscribe](
        handleChangeWrapper,
        props,
        connectOptions
      )

      listeners = createListenerCollection()
    }
  }

  function tryUnsubscribe() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = undefined
      listeners.clear()
      listeners = nullListeners
    }
  }

  const subscription = {
    addNestedSub,
    notifyNestedSubs,
    handleChangeWrapper,
    isSubscribed,
    trySubscribe,
    tryUnsubscribe,
    getListeners: () => listeners,
  }

  return subscription
}
