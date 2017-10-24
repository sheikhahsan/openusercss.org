import navbar from '../elements/navbar/navbar.vue'
import {LeftRight} from '../../../src/components/animations'

export default {
  'components': {
    navbar
  },
  created () {
    this.$store.dispatch('getOfflineToken')
    this.$store.dispatch('verifyToken')
  },
  'methods': new LeftRight()
}