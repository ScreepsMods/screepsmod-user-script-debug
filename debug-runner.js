var bulk = require('@screeps/driver/lib/bulk'),
    queue = require('@screeps/driver/lib/queue'),
    EventEmitter = require('events').EventEmitter,
    common = require('@screeps/common'),
    db = common.storage.db,
    env = common.storage.env,
    pubsub = common.storage.pubsub,
    q = require('q'),
    vm = require('vm'),
    _ = require('lodash'),
    child_process = require('child_process'),
    util = require('util'),
    runtimeChild, runtimeDeferred, runtimeTimeout, runtimeData, runtimeRestartSignalReceived = false,
    runtimeCache = {},
    roomStatsUpdates = {},
    zlib = require('zlib'),
    accessibleRoomsCache = {
        timestamp: 0
    };

function makeDebugRuntime(config, userId, onlyInRoom)
{
	return config.engine.driver.getUserData(userId)
	.then((_runtimeData) => 
	{
		runtimeDeferred = q.defer();
		runtimeData = _runtimeData;
		runtimeData.cpu = Infinity;
		
		if (!runtimeChild || !runtimeChild.connected) 
		{
			let args = process.execArgv;
			args.push('--debug=6001');
			args.push('--nolazy');
		//	args.push('--remote-debugging-port=9222');
		//	args.push('--enable-logging');
		//	args.push('--inspect');

			runtimeChild = child_process.fork(require.resolve('@screeps/driver/lib/runtime.js'), [], { execArgv: args });

			console.log(`New child debug runtime process ${runtimeChild.pid}, port 6001`);

			runtimeChild.on('message', function(message) 
			{
				switch (message.type) 
				{
					case 'start':
						break;
					case 'done':
						var $set = {
							lastUsedCpu: message.usedTime,
							lastUsedDirtyTime: message.usedDirtyTime
						};
						if (runtimeData.cpu < Infinity) 
						{
							var newCpuAvailable = runtimeData.user.cpuAvailable + runtimeData.user.cpu - message.usedTime;
							if(newCpuAvailable > config.engine.cpuBucketSize) 
							{
								newCpuAvailable = config.engine.cpuBucketSize;
							}
							$set.cpuAvailable = newCpuAvailable;
						}
						db.users.update({_id: runtimeData.user._id}, {$set});

						pubsub.publish(`user:${runtimeData.user._id}/cpu`, JSON.stringify({
							cpu: message.usedTime,
							memory: message.memory.data.length
						}));

						message.username = runtimeData && runtimeData.user && runtimeData.user.username;

						runtimeDeferred.resolve(message);
						break;
					case 'error':
						message.username = runtimeData && runtimeData.user && runtimeData.user.username;

						runtimeDeferred.reject(message);

						var $set = {
							lastUsedCpu: message.usedTime,
							lastUsedDirtyTime: message.usedDirtyTime
						};
						if (runtimeData.cpu < Infinity) 
						{
							var newCpuAvailable = runtimeData.user.cpuAvailable + runtimeData.user.cpu - message.usedTime;
							if(newCpuAvailable > config.engine.cpuBucketSize) 
							{
								newCpuAvailable = config.engine.cpuBucketSize;
							}
							$set.cpuAvailable = newCpuAvailable;
						}
						db.users.update({_id: runtimeData.user._id}, {$set});

						if (message.error == 'Script execution has been terminated: CPU limit reached') 
						{
							pubsub.publish(`user:${runtimeData.user._id}/cpu`, JSON.stringify({
								cpu: 'error',
								memory: message.memory.data.length
							}));
						}
						else 
						{
							pubsub.publish(`user:${runtimeData.user._id}/cpu`, JSON.stringify({
								cpu: message.usedTime,
								memory: message.memory.data.length
							}));
						}
						break;
					case 'reject':
						message.username = runtimeData && runtimeData.user && runtimeData.user.username;
						if(message.error) 
						{

							if(message.error == 'Security policy violation') 
							{
								runtimeChild._killRequest = true;
								runtimeChild.kill('SIGKILL');
								runtimeChild = null;
							}

							message.error = 'Script execution has been terminated due to a fatal error: '+message.error;
						}
						runtimeDeferred.reject(message);
						break;
					default:
						break;
				}
			});

			runtimeChild.on('exit', function(code, signal) 
			{
				console.log(`Child runtime process ${this.pid} exited with code=${code} signal=${signal}`);

				if(this.connected) 
				{
					this.disconnect();
				}

				if(signal == 'SIGKILL' && this._killRequest) 
				{
					return;
				}

				if(runtimeChild === this) 
				{
					runtimeChild = null;
					console.log(`Runtime worker reset due to child exit: code=${code} signal=${signal} user=${runtimeData.user.username} (${runtimeData.user._id}) promise pending=${runtimeDeferred.promise.isPending()}`);

					if(runtimeDeferred.promise.isPending()) 
					{
						runtimeDeferred.reject({
							type: 'error',
							error: 'Script execution has been terminated: Unknown system error'
						});
					}
				}
			});
		}

		runtimeChild.send({userId, onlyInRoom});

		return runtimeDeferred.promise;
	});
}

function getRuntimeData(config, userId, onlyInRoom) 
{
	var promise = config.engine.driver.getRuntimeDataOld(userId, onlyInRoom);

	return promise.then(runtimeData => 
	{
		runtimeData.cpu = Infinity;
		return runtimeData;
	});
}

module.exports = function(config) 
{
	if(config.engine) 
	{
		config.engine.mainLoopResetInterval = 500000;
		config.engine.cpuMaxPerTick = Infinity;

		config.engine.driver.getRuntimeDataOld = config.engine.driver.getRuntimeData;
		config.engine.driver.getRuntimeData = getRuntimeData.bind(config.engine.driver, config);

		config.engine.driver.makeRuntime = makeDebugRuntime.bind(config.engine.driver, config);
	}
};
