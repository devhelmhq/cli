.PHONY: build test lint typecheck release

build:
	npm run build

test:
	npm test

lint:
	npm run lint

typecheck:
	npm run typecheck

check: lint typecheck test

release:
	@./scripts/release.sh $(VERSION)
