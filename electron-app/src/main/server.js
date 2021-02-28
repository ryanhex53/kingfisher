const http = require('http');
const Koa = require('koa');
const Router = require('@koa/router');
const koaBody = require('koa-body');
const app = new Koa();
const router = new Router();

router.get('/ping', (ctx, next) => {
  ctx.body = Date.now();
});

router.post('/clipboard', (ctx, next) => {
  console.log(ctx.request.body);
  console.log(ctx.request.files);
  process.send({
    channel: 'put-clipboard',
    body: ctx.request.body,
    files: ctx.request.files
  });
  ctx.status = 200;
});

router.post('/file', (ctx, next) => {
  if (ctx.request.files.file) {
    process.send({
      channel: 'post-file',
      files: ctx.request.files
    });
    ctx.status = 200;
  } else {
    ctx.status = 403;
  }
});

router.post('/partner', (ctx, next) => {
  if (!isNaN(Number(ctx.request.body.http_port)) && ctx.request.body.host_name) {
    ctx.status = 200;
    process.send({
      channel: 'remote-partner',
      remote_address: ctx.ip,
      host_name: ctx.request.body.host_name,
      http_port: Number(ctx.request.body.http_port)
    });
  } else {
    ctx.status = 403;
  }
});

router.delete('/partner', (ctx, next) => {
  process.send({
    channel: 'del-partner',
    remote_address: ctx.ip
  });
  ctx.status = 200;
});

app.use(koaBody({ multipart: true, formidable: { maxFileSize: 524288000 } }));//maxFileSize 500Mb
app.use(router.routes()).use(router.allowedMethods());

const server = http.createServer(app.callback());
server.listen(0, '0.0.0.0', () => {
  process.send({ channel: 'http-up', address: server.address() });
  console.log('http', server.address());
});