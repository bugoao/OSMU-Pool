import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Socket } from 'net';
import { BehaviorSubject } from 'rxjs';
import { DataSource } from 'typeorm';

import { MockRecording1 } from '../../test/models/MockRecording1';
import { AddressSettingsModule } from '../ORM/address-settings/address-settings.module';
import { AddressSettingsService } from '../ORM/address-settings/address-settings.service';
import { BlocksService } from '../ORM/blocks/blocks.service';
import { ClientStatisticsEntity } from '../ORM/client-statistics/client-statistics.entity';
import { ClientStatisticsModule } from '../ORM/client-statistics/client-statistics.module';
import { ClientStatisticsService } from '../ORM/client-statistics/client-statistics.service';
import { ClientEntity } from '../ORM/client/client.entity';
import { ClientModule } from '../ORM/client/client.module';
import { ClientService } from '../ORM/client/client.service';
import { BitcoinRpcService as MockBitcoinRpcService } from '../services/bitcoin-rpc.service';
import { NotificationService } from '../services/notification.service';
import { StratumV1JobsService } from '../services/stratum-v1-jobs.service';
import { IMiningInfo } from './bitcoin-rpc/IMiningInfo';
import { StratumV1Client } from './StratumV1Client';

jest.mock('../services/bitcoin-rpc.service')

jest.mock('./validators/bitcoin-address.validator', () => ({
    IsBitcoinAddress() {
        return jest.fn();
    },
}));


describe('StratumV1Client', () => {


    let socket: Socket;
    let stratumV1JobsService: StratumV1JobsService;
    let bitcoinRpcService: MockBitcoinRpcService;

    let clientService: ClientService;
    let clientStatisticsService: ClientStatisticsService;
    let notificationService: NotificationService;
    let blocksService: BlocksService;
    let configService: ConfigService;

    let client: StratumV1Client;

    let socketEmitter: (...args: any[]) => void;

    let newBlockEmitter: BehaviorSubject<IMiningInfo> = new BehaviorSubject(null);

    let moduleRef: TestingModule;

    beforeAll(async () => {
        moduleRef = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: './DB/public-pool.test.sqlite',
                    synchronize: true,
                    autoLoadEntities: true,
                    cache: true,
                    logging: false
                }),
                ClientModule,
                ClientStatisticsModule,
                AddressSettingsModule
            ],
            providers: [
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            switch (key) {
                                case 'DEV_FEE_ADDRESS':
                                    return 'tb1qumezefzdeqqwn5zfvgdrhxjzc5ylr39uhuxcz4';
                                case 'NETWORK':
                                    return 'testnet';
                            }
                            return null;
                        })
                    }
                }
            ],
        }).compile();


    })


    beforeEach(async () => {

        console.log('NEW TEST')

        clientService = moduleRef.get<ClientService>(ClientService);

        const dataSource = moduleRef.get<DataSource>(DataSource);

        dataSource.getRepository(ClientEntity).delete({});
        dataSource.getRepository(ClientStatisticsEntity).delete({});


        clientStatisticsService = moduleRef.get<ClientStatisticsService>(ClientStatisticsService);

        configService = moduleRef.get<ConfigService>(ConfigService);


        bitcoinRpcService = new MockBitcoinRpcService(configService,null);
        jest.spyOn(bitcoinRpcService, 'getBlockTemplate').mockReturnValue(Promise.resolve(MockRecording1.BLOCK_TEMPLATE));
        bitcoinRpcService.newBlock$ = newBlockEmitter.asObservable();


        stratumV1JobsService = new StratumV1JobsService(bitcoinRpcService);

        socket = new Socket();
        // jest.spyOn(socket, 'on').mockImplementation((event: string, fn: (data: Buffer) => void) => {
        //     socketEmitter = fn;
        // });

        jest.spyOn(socket, 'on').mockImplementation((event: string, listener: (...args: any[]) => void) => {
            socketEmitter = listener;
            return socket;
        });

        socket.end = jest.fn();

        const addressSettings = moduleRef.get<AddressSettingsService>(AddressSettingsService);


        client = new StratumV1Client(
            socket,
            stratumV1JobsService,
            bitcoinRpcService,
            clientService,
            clientStatisticsService,
            notificationService,
            blocksService,
            configService,
            addressSettings
        );

        client.extraNonceAndSessionId = MockRecording1.EXTRA_NONCE;

        jest.useFakeTimers({ advanceTimers: true })
    });

    afterEach(async () => {
        client.destroy();
        jest.useRealTimers();
    })


    it('should subscribe to socket', () => {
        expect(socket.on).toHaveBeenCalled();
    });

    it('should close socket on invalid JSON', () => {
        socketEmitter(Buffer.from('INVALID'));
        jest.spyOn(socket, 'destroy');
        expect(socket.on).toHaveBeenCalled();
    });

    it('should respond to mining.subscribe', async () => {
        jest.spyOn(socket, 'write').mockImplementation((data) => true);

        expect(socket.on).toHaveBeenCalled();
        socketEmitter(Buffer.from(MockRecording1.MINING_SUBSCRIBE));

        await new Promise((r) => setTimeout(r, 1));

        expect(socket.write).toHaveBeenCalledWith(`{"id":1,"error":null,"result":[[["mining.notify","${client.extraNonceAndSessionId}"]],"${client.extraNonceAndSessionId}",8]}\n`, expect.any(Function));

    });


    it('should respond to mining.configure', async () => {

        jest.spyOn(socket, 'write').mockImplementation((data) => true);

        expect(socket.on).toHaveBeenCalled();
        socketEmitter(Buffer.from(MockRecording1.MINING_CONFIGURE));
        await new Promise((r) => setTimeout(r, 1));
        expect(socket.write).toHaveBeenCalledWith(`{"id":2,"error":null,"result":{"version-rolling":true,"version-rolling.mask":"1fffe000"}}\n`, expect.any(Function));
    });

    it('should respond to mining.authorize', async () => {

        jest.spyOn(socket, 'write').mockImplementation((data) => true);

        expect(socket.on).toHaveBeenCalled();
        socketEmitter(Buffer.from(MockRecording1.MINING_AUTHORIZE));
        await new Promise((r) => setTimeout(r, 1));
        expect(socket.write).toHaveBeenCalledWith('{"id":3,"error":null,"result":true}\n', expect.any(Function));
    });

    it('should respond to mining.suggest_difficulty', async () => {
        jest.spyOn(socket, 'write').mockImplementation((data) => true);

        expect(socket.on).toHaveBeenCalled();
        socketEmitter(Buffer.from(MockRecording1.MINING_SUGGEST_DIFFICULTY));
        await new Promise((r) => setTimeout(r, 1));
        expect(socket.write).toHaveBeenCalledWith(`{"id":null,"method":"mining.set_difficulty","params":[512]}\n`, expect.any(Function));
    });

    it('should set difficulty', async () => {
        jest.spyOn(client as any, 'write').mockImplementation((data) => Promise.resolve(true));

        console.log('should set difficulty')
        socketEmitter(Buffer.from(MockRecording1.MINING_SUBSCRIBE));
        socketEmitter(Buffer.from(MockRecording1.MINING_AUTHORIZE));
        await new Promise((r) => setTimeout(r, 100));

        expect((client as any).write).toHaveBeenCalledWith(`{"id":null,"method":"mining.set_difficulty","params":[16384]}\n`);

    });

    it('should save client', async () => {
        jest.spyOn(client as any, 'write').mockImplementation((data) => Promise.resolve(true));

        socketEmitter(Buffer.from(MockRecording1.MINING_SUBSCRIBE));
        socketEmitter(Buffer.from(MockRecording1.MINING_AUTHORIZE));
        await new Promise((r) => setTimeout(r, 100));

        const clientCount = await clientService.connectedClientCount();
        expect(clientCount).toBe(1);

    });

    it('should send job and accept submission', async () => {

        const date = new Date(parseInt(MockRecording1.TIME, 16) * 1000);
        jest.setSystemTime(date);

        jest.spyOn(client as any, 'write').mockImplementation((data) => Promise.resolve(true));

        socketEmitter(Buffer.from(MockRecording1.MINING_SUBSCRIBE));
        socketEmitter(Buffer.from(MockRecording1.MINING_SUGGEST_DIFFICULTY));
        socketEmitter(Buffer.from(MockRecording1.MINING_AUTHORIZE));

        await new Promise((r) => setTimeout(r, 100));

        const calls = (client as any).write.mock.calls;
        const lastWrite = calls[calls.length - 1][0];
        const parsed = JSON.parse(lastWrite);

        expect(parsed.method).toBe('mining.notify');
        expect(Array.isArray(parsed.params)).toBe(true);
        expect(parsed.params[0]).toBe('1'); // jobId
        expect(typeof parsed.params[1]).toBe('string'); // prevHash (hex)
        expect(typeof parsed.params[2]).toBe('string'); // coinbasePart1
        expect(typeof parsed.params[3]).toBe('string'); // coinbasePart2
        expect(Array.isArray(parsed.params[4])).toBe(true); // merkle_branch
        expect(typeof parsed.params[5]).toBe('string'); // version hex
        expect(typeof parsed.params[6]).toBe('string'); // bits hex
        expect(typeof parsed.params[7]).toBe('string'); // time hex
        expect(parsed.params[8]).toBe(false); // clearJobs

        socketEmitter(Buffer.from(MockRecording1.MINING_SUBMIT));

        jest.useRealTimers();
        await new Promise((r) => setTimeout(r, 1000));

        expect((client as any).write).lastCalledWith(`{\"id\":5,\"error\":null,\"result\":true}\n`);
    });

});
