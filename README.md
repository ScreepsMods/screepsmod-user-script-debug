[![NPM](https://nodei.co/npm/screeps-user-script-debug-mod.png)](https://npmjs.org/package/screeps-user-script-debug-mod)

# screeps-user-script-debug-mod
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
		}
	]
}
```
