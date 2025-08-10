# Arena 4 Test 1

## Test Setup

setup: http://localhost:5173/#/?g=twMLACtbmkSpkkvJKlgsZUoiiYgRJEGGrBHAlgdoCp1RBqBqAyxlgA
arena: Arena IV

## Enemy Team Positions

- Character 1: Tile 37
- Character 2: Tile 38
- Character 3: Tile 40
- Character 4: Tile 42
- Character 5: Tile 43
- Character 6: Tile 45

## Test Cases

```
silvina tile: 1
symmetrical tile: 44
expected target: 42
```

```
silvina tile: 3
symmetrical tile: 41
expected target: 37
```

```
silvina tile: 4
symmetrical tile: 42
expected target: 42
```

```
silvina tile: 6
symmetrical tile: 39
expected target: 37
```

```
silvina tile: 8
symmetrical tile: 36
expected target: 37
```

```
silvina tile: 9
symmetrical tile: 37
expected target: 37
```

```
silvina tile: 21
symmetrical tile: 28
expected target: 38
```

```
silvina tile: 24
symmetrical tile: 24
expected target: 38
```

```
silvina tile: 28
symmetrical tile: 21
expected target: 38
```
