CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2
SRCS = backend/main.cpp backend/Library.cpp
OBJS = $(SRCS:.cpp=.o)
TARGET = libtrack_server

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(OBJS)

backend/%.o: backend/%.cpp backend/DataStructures.h backend/Library.h
	$(CXX) $(CXXFLAGS) -c $< -o $@

test: $(TARGET)
	$(CXX) $(CXXFLAGS) tests/test_dsa.cpp -o tests/test_dsa
	./tests/test_dsa
	python3 tests/test_api.py
	python3 tests/test_workflow.py

clean:
	rm -f $(OBJS) $(TARGET) tests/test_dsa

run: $(TARGET)
	./$(TARGET)

.PHONY: all clean run

