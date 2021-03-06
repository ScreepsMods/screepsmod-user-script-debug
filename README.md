[![NPM](https://nodei.co/npm/screepsmod-user-script-debug.png)](https://npmjs.org/package/screepsmod-user-script-debug)

# screepsmod-user-script-debug
Local server mod for debugging user scripts.

Launches runner with --debug 6001, disables relaunch, gives all users infinite CPU.

## Manual steps
Runners count must be limited to 1 in `.screepsrc`
```
runners_cnt = 1
```

## Connecting from VSCode

Create launch configuration `.vscode/launch.json`

```
{
	"version": "0.2.0",
	"configurations": [
		{
			"type": "node",
			"request": "attach",
			"name": "Attach to Process",
			"port": 6001,
			"protocol": "legacy"
		}
	]
}
```

Some versions of VSCode might behave [funny](https://github.com/Microsoft/vscode/issues/24298) with screeps. If you have other bots on the server and get dropped into wrong bot on a breakpoint, consider disabling all bots but yours or downgrading IDE.
