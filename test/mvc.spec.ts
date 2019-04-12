import * as chai from 'chai'
import { contextConfiguration, Test, run, OnlyRun, Describe, before, after } from '@rockerjs/tsunit';
import { app } from './app'
import * as request from 'request-promise'
import * as md5 from 'md5'
import * as fs from 'fs'
import * as path from 'path'
import { resolve } from 'url';
import * as mysql from './fakeServer/common'

const expect = chai.expect;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(() => {
    resolve()
  }, ms);
})

class MVCSpec {


  @before
  async before() {

    let createFakeServer = () => new Promise((resolve, reject) => {
      let server = mysql.createFakeServer()

      server.listen(mysql.fakeServerPort, () => resolve())
      server.on('connection', function(conn) {
        conn.handshake();
        conn.on('query', function(packet) {
          switch (packet.sql.trim()) {
            case `select * from app_info where username='yangli'`:
              this._sendPacket(new mysql.Packets.ResultSetHeaderPacket({
                fieldCount: 2
              }));

              this._sendPacket(new mysql.Packets.FieldPacket({
                catalog    : 'def',
                charsetNr  : mysql.Charsets.UTF8_GENERAL_CI,
                name       : 'appname',
                protocol41 : true,
                type       : mysql.Types.VARCHAR
              }));

              this._sendPacket(new mysql.Packets.FieldPacket({
                catalog    : 'def',
                charsetNr  : mysql.Charsets.UTF8_GENERAL_CI,
                name       : 'username',
                protocol41 : true,
                type       : mysql.Types.VARCHAR
              }));


              this._sendPacket(new mysql.Packets.EofPacket())

              var writer = new mysql.PacketWriter();
              writer.writeLengthCodedString('dingjunjie');
              writer.writeLengthCodedString('yangli');
              this._socket.write(writer.toBuffer(this._parser));

              var writer = new mysql.PacketWriter();
              writer.writeLengthCodedString('IOriens');
              writer.writeLengthCodedString('yangli');
              this._socket.write(writer.toBuffer(this._parser));

              this._sendPacket(new mysql.Packets.EofPacket());
              this._parser.resetPacketNumber();
              break;
            default:
              this._handleQueryPacket(packet);
              break;
          }
        });
      });
    })


    await createFakeServer()

    await app()
  }


  @Test('test render ejs')
  async testRenderEJSSuccess() {
    let res = await request('http://localhost:8080/home/user')
    expect(res).to.include('<h2>foo</h2>')
  }

  @Test('test auth')
  async testAuthSuccess() {
    let res = await request('http://localhost:8080/home/needAuth')
    expect(res).to.be.a('string');;
    expect(res).to.include('Example Domain')
  }

  @Test('test no need auth')
  async testNoNeedAuthSuccess() {
    let res = await request('http://localhost:8080/home/dontNeedAuth')
    expect(res).to.equal('{"foo":"bar"}');;
  }

  @Test('test error handling')
  async testErrorHandleSuccess() {
    let res = await request('http://localhost:8080/home/error')
    expect(res).to.equal('{"status":{"code":1,"message":"test errorprocessor"}}');;
  }

  @Test('test no such url error handling')
  async testNoSuchUrlSuccess() {
    let res = await request('http://localhost:8080/home/666666')
    expect(res).to.equal('{"status":{"code":404,"message":"The request url(/home/666666, full path: /home/666666, method: GET) not found."}}');;
  }


  @Test('test sql request')
  async testSQLRequestSuccess() {
    let data = {
      name: 'foo',
      person: JSON.stringify({
        a: 1,
        b: 2
      })
    }
    let res = await request.post('http://localhost:8080/home/mysql', { form: data })
    console.log(res)

    expect(res).to.include('"person":{"a":1,"b":2}');
    expect(res).to.include('"name":"foo"');
  }

  @Test('test head type request')
  async testHeadRequest() {
    let res = await request.head('http://localhost:8080/home/head')
    console.log(res)
    expect(res).to.have.property(`content-type`);
  }

  @Test('test redirect type request')
  async testRedirectRequest() {
    let res = await request.get('http://localhost:8080/home/redirect')
    expect(res).to.include(`微店`);
  }

  @Test('test static assets')
  async testStaticAssetsSuccess() {
    let res = await request.get({
      url: 'http://localhost:8080/assets/favicon.jpg',
      encoding: null
    })

    let buffer = Buffer.from(res, 'utf8');
    let fsContent = fs.readFileSync(path.resolve(__dirname, 'app/assets/favicon.jpg'))
    expect(md5(buffer)).to.equal(md5(fsContent));

    await sleep(1000)

    res = await request.get({
      url: 'http://localhost:8080/assets/favicon.jpg',
      encoding: null
    })
    buffer = Buffer.from(res, 'utf8');
    fsContent = fs.readFileSync(path.resolve(__dirname, 'app/assets/favicon.jpg'))
    expect(md5(buffer)).to.equal(md5(fsContent));

  }

}



export { MVCSpec };
