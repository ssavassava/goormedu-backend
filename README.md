## How to Start?

package.json 에 3가지 실행 명령어가 등록되어 있습니다.

```json
"scripts": {
    "build": "babel src -d build",
    "start": "npm run build && node build/index.js",
    "start:dev": "nodemon --exec babel-node src/index.js"
  },
```

초기 실행 시 npm run build 를 통해 trans-compile 을 진행하고

npm run start:dev 를 통해 실행합니다.

처음 build에서는 서버가 잘 실행되었지만

**npm run start:dev 로 재 실행시 DB Connection Fail이 throw 된다면**

src - db.js 의 synchronize 옵션이 문제입니다.

처음 실행시는 데이터베이스 structure 생성을 위해 true로 진행하여도 되지만

이후 DB 스키마 구조가 이미 완성된 이후에 true 상태인 경우 Connection Fail이 발생합니다.

## 주요 모듈

### Babel

자바스크립트는 compile 언어가 아닌 interpreter 언어입니다. 

ES6+ 이후 문법으로 자바스크립트 문법을 사용 시 크롬, 파이어폭스를 제외한 모든 브라우저에서 자바스크립트 호환 문제가 발생되기에 ES5로 trans-compile을 진행해주는 모듈입니다.

하지만 바벨이 코드 구조를 파악한 뒤 재 생성해주는 역할을 맡을 뿐이라 컴파일 언어처럼 사용되는 것은 아닙니다.

> “strict mode” 까지 자동으로 적용되는 걸 확인함
> 

### Nodemon

노드가 실행하는 파일이 속한 디렉터리를 감시하고 있다가 

파일이 수정되면 자동으로 노드 애플리케이션을 재시작하는 확장 모듈입니다.

## 환경변수 파일

— gitignore에 등록되어 있기 때문에 git에 push 되지 않습니다.

— 직접 등록이 필요합니다.

내장된 dotenv 모듈이 npm의 루트 디렉토리에 있는 .env 파일을 

process.env 객체에 등록시키는데 

본인이 설정한 내용은 아래와 같습니다.

```html
GOOGLE_CLIENT_ID=수정필요
GOOGLE_SECRET=수정필요
JWT_PRIVATEKEY=MySecretKey1$1$234
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=root
DB_DATABASE=test
PORT=4000
```

JWT_PRIVATEKEY는 어떠한 문자열이어도 상관없습니다.
>