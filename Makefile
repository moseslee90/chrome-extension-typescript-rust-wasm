make :
	npm install -g typescript
	npm install
	wasm-pack build src/rust/ --out-dir ../../pkg
	tsc -b tsconfig.json
	npm run build
compile :
	wasm-pack build src/rust/ --out-dir ../../pkg
	tsc -b tsconfig.json
	npm run build
install :
	npm install -g typescript
	npm install
rust :
	wasm-pack build src/rust/ --out-dir ../../pkg
ts :
	tsc -b tsconfig.json
	npm run build