# Arena 1 Test 1

## Test Setup

setup: http://localhost:5173/#/?g=rwMTAKtamkKlkqXIUqdSeQxFSkkTKEWOJGEihIgRJEGGtC5ANQLIegBFB6AHAQQ
arena: Arena I

## Enemy Team Positions

- Character 1: Tile 30
- Character 2: Tile 34
- Character 3: Tile 42
- Character 4: Tile 44
- Character 5: Tile 45

## Test Cases

```
silvina tile: 1
symmetrical tile: 44
expected target: 44
```

```
silvina tile: 2
symmetrical tile: 45
expected target: 45
```

```
silvina tile: 3
symmetrical tile: 41
expected target: 44
```

```
silvina tile: 4
symmetrical tile: 42
expected target: 42
```

```
silvina tile: 5
symmetrical tile: 43
expected target: 45
```

```
silvina tile: 6
symmetrical tile: 39
expected target: 44
```

```
silvina tile: 7
symmetrical tile: 40
expected target: 45
```

```
silvina tile: 8
symmetrical tile: 36
expected target: 30
```

```
silvina tile: 9
symmetrical tile: 37
expected target: 42
```

```
silvina tile: 10
symmetrical tile: 38
expected target: 34
```

```
silvina tile: 12
symmetrical tile: 33
expected target: 30
```

```
silvina tile: 13
symmetrical tile: 34
expected target: 34
```

```
silvina tile: 16
symmetrical tile: 30
expected target: 30
```
