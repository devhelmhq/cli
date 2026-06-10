// Back-compat shim: `data services uptime` is the legacy spelling of
// `services uptime`. Re-exporting the class registers the same command
// under the old id so existing scripts keep working.
export {default} from '../../services/uptime.js'
