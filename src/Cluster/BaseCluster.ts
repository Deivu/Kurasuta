import { ShardingManager } from '..';
import { Client, ClientOptions } from 'discord.js';
import { ShardClientUtil } from '../Sharding/ShardClientUtil';
import { IPCEvents } from '../Util/Constants';
import * as Util from '../Util/Util';

export interface CloseEvent {
	code: number;
	reason: string;
	wasClean: boolean;
}

export abstract class BaseCluster {
	public readonly client: Client;
	public readonly id: number;

	constructor(public manager: ShardingManager) {
		const env = process.env;
		const shards = env.CLUSTER_SHARDS!.split(',').map(Number);
		const clientConfig: ClientOptions = Util.mergeDefault<ClientOptions>(manager.clientOptions, {
			shards,
			shardCount: shards.length,
			totalShardCount: Number(env.CLUSTER_SHARD_COUNT)
		});
		this.client = new manager.client(clientConfig);
		const client: any = this.client;
		client.shard = new ShardClientUtil(client, manager.ipcSocket);
		this.id = Number(env.CLUSTER_ID);
	}

	public async init(): Promise<void> {
		const shardUtil = ((this.client.shard as any) as ShardClientUtil);
		await shardUtil.init();
		this.client.once('KashimaReady', () => shardUtil.send({ op: IPCEvents.READY, d: this.id }, { receptive: false }));
		this.client.on('shardReady', (id: number) => shardUtil.send({ op: IPCEvents.SHARDREADY, d: { id: this.id, shardID: id } }, { receptive: false }));
		this.client.on('reconnecting', (id: number) => shardUtil.send({ op: IPCEvents.SHARDRECONNECT, d: { id: this.id, shardID: id } }, { receptive: false }));
		this.client.on('resumed', (replayed: number, id: number ) => shardUtil.send({ op: IPCEvents.SHARDRESUMED, d: { id: this.id, shardID: id, replayed } }, { receptive: false }));
		this.client.on('disconnect', (closeEvent: CloseEvent, id: number) => shardUtil.send({ op: IPCEvents.SHARDDISCONNECT, d: { id: this.id, shardID: id, closeEvent } }, { receptive: false }));
		await this.launch();
	}

	protected abstract launch(): Promise<void>;
}
