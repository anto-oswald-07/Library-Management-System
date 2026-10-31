# LibTrack Makefile (Node.js & Express Backend)

.PHONY: all run start test clean

all:
	@echo "LibTrack is now running on Node.js and Express."
	@echo "Run 'npm start' or 'make run' to launch the application."

start: run

run:
	node backend/server.js 8080

test:
	npm test

clean:
	rm -rf .DS_Store
