// Back-compat shim: `data services status` is the legacy spelling of
// `services status`. Re-exporting the class registers the same command
// under the old id so existing scripts keep working.
export {default} from '../../services/status.js'
