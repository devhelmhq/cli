import {Flags} from '@oclif/core'

export const secretValueFlags = {
  'value-stdin': Flags.boolean({description: 'Read the value from stdin (printf %s "$VALUE" | devhelm …)', default: false}),
  'from-env': Flags.string({description: 'Read the value from this environment variable'}),
}

export const DEPRECATED_VALUE_FLAG =
  '--value is deprecated since 1.12 and is removed on 2027-01-31: values passed as arguments land in shell history and CI logs. Use --value-stdin or --from-env VAR'
