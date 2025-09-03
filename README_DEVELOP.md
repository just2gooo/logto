# connector如何debug
* 先安装一个本地的logto,参考 https://docs.logto.io/zh-CN/logto-oss/using-cli/install-logto
`logto init -p /tmp/logto --db-url postgresql://admin:admin@localhost:5433/logto --ss`
* 再到已经开发好的connector的顶层logto目录中(假设为`~/logto`)，执行`pnpm preinstall && pnpm install`
* 再到connector目录中，执行`pnpm build`
* 到/tmp/logto目录下，执行`npm run cli connector add ~/logto/packages/connectors/connector-carsi`
* 再启动logto服务进行测试`npm start`
