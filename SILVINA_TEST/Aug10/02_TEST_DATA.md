# Silvina Test Data - Complete Results

## Test C - Controlled Tie (Enemies: 37, 42)
**Purpose**: Key test that revealed position-dependent behavior  
**Success Rate**: 12/13 (92%)

| Silvina | Sym | Expected | Actual | Match | Notes |
|---------|-----|----------|--------|-------|-------|
| 1 | 44 | 42 | 42 | ✅ | Upper zone |
| 2 | 45 | 42 | 42 | ✅ | Upper zone |
| 3 | 41 | 37 | 37 | ✅ | Left zone |
| 4 | 42 | 42 | 42 | ✅ | On diagonal |
| 5 | 43 | 42 | 42 | ✅ | Right zone |
| 6 | 39 | 37 | 37 | ✅ | Left zone |
| 7 | 40 | 42 | 42 | ✅ | Right zone |
| 8 | 36 | 37 | 37 | ✅ | Left zone |
| 9 | 37 | 37 | 37 | ✅ | On target |
| 10 | 38 | 42 | 42 | ✅ | Right zone |
| 12 | 33 | 37 | 37 | ✅ | Left zone |
| 13 | 34 | 37 | 37 | ✅ | Inconsistent |
| 16 | 30 | 37 | 37 | ✅ | Left zone |

## Test D - Three-Way Tie (Enemies: 37, 40, 42)
**Purpose**: Test behavior with three equidistant enemies

| Silvina | Sym | Expected | Distance Info |
|---------|-----|----------|---------------|
| 1 | 44 | 42 | All dist 2 |
| 2 | 45 | 42 | All dist 2 |
| 3 | 41 | 37 | All dist 2 |
| 4 | 42 | 42 | On target |
| 5 | 43 | 40 | All dist 2 |
| 6 | 39 | 37 | 40 dist 1, others dist 2 |
| 7 | 40 | 40 | On target |
| 8 | 36 | 37 | 37 dist 1, others dist 2 |
| 9 | 37 | 37 | On target |
| 10 | 38 | 40 | 37,40 dist 1, 42 dist 2 |
| 12 | 33 | 37 | 37 dist 1, others dist 2 |
| 13 | 34 | 40 | All dist 2 |

## Test E - Reverse Positions (Enemies: 38, 44)
**Purpose**: Test with enemies in opposite configuration

| Silvina | Sym | Expected | Distance Info |
|---------|-----|----------|---------------|
| 1 | 44 | 44 | On target |
| 2 | 45 | 44 | Both dist 1 |
| 3 | 41 | 38 | 38 dist 2, 44 dist 3 |
| 4 | 42 | 38 | 38 dist 1, 44 dist 2 |
| 5 | 43 | 38 | 38 closer |
| 6 | 39 | 38 | 38 dist 1, 44 dist 3 |
| 7 | 40 | 44 | 38 dist 2, 44 dist 1 |
| 8 | 36 | 38 | 38 dist 2, 44 dist 3 |
| 9 | 37 | 44 | Both dist 1 |
| 10 | 38 | 38 | On target |

## Test F - Adjacent (Enemies: 37, 38)
**Purpose**: Test with adjacent enemies

| Silvina | Sym | Expected | Notes |
|---------|-----|----------|-------|
| 1 | 44 | 37 | Both dist 2, prefer lower |
| 2 | 45 | 37 | Both dist 2, prefer lower |
| 3 | 41 | 37 | 37 dist 1, 38 dist 2 |
| 4 | 42 | 37 | 37 dist 1, 38 dist 2 |
| 5 | 43 | 37 | Both dist 1, prefer lower |
| 6 | 39 | 37 | Both dist 2, prefer lower |
| 7 | 40 | 37 | Both dist 2, prefer lower |
| 8 | 36 | 37 | Both dist 1, prefer lower |
| 9 | 37 | 37 | On target |
| 10 | 38 | 38 | On target |
| 12 | 33 | 37 | Both dist 1, prefer lower |
| 13 | 34 | 37 | Both dist 1, prefer lower |

## Test I - Symmetrical (Enemies: 33, 37)
**Purpose**: Test with symmetrically placed enemies

| Silvina | Sym | Expected | Notes |
|---------|-----|----------|-------|
| 1 | 44 | 33 | 33 dist 2, 37 dist 2 |
| 2 | 45 | 33 | 33 dist 2, 37 dist 2 |
| 3 | 41 | 33 | 33 dist 2, 37 dist 2 |
| 5 | 43 | 33 | 33 dist 1, 37 dist 2 |
| 6 | 39 | 37 | 33 dist 2, 37 dist 2 |
| 7 | 40 | 33 | 33 dist 1, 37 dist 2 |
| 8 | 36 | 37 | 33 dist 2, 37 dist 1 |
| 9 | 37 | 37 | On target |
| 10 | 38 | 33 | 33 dist 1, 37 dist 1 |
| 12 | 33 | 33 | On target |
| 13 | 34 | 33 | 33 dist 1, 37 dist 2 |
| 16 | 30 | 37 | Both dist 1, expects 37 |

## Test M - Clean Diagonal (Enemies: 36, 43)
**Purpose**: Perfect zone separation test  
**Success Rate**: 13/13 (100%)

| Silvina | Sym | Expected | Pattern |
|---------|-----|----------|---------|
| 1 | 44 | 36 | LEFT zone → lower |
| 2 | 45 | 43 | RIGHT zone → higher |
| 3 | 41 | 36 | LEFT zone → lower |
| 4 | 42 | 36 | Diagonal → lower |
| 5 | 43 | 43 | On target |
| 6 | 39 | 36 | LEFT zone → lower |
| 7 | 40 | 43 | RIGHT zone → higher |
| 8 | 36 | 36 | On target |
| 9 | 37 | 36 | Diagonal → lower |
| 10 | 38 | 43 | RIGHT zone → higher |
| 12 | 33 | 36 | LEFT zone → lower |
| 13 | 34 | 43 | RIGHT zone → higher |
| 16 | 30 | 36 | LEFT zone → lower |

## Cross-Arena Results

### Arena III Test (Enemies: 25, 30, 32, 37, 39, 42, 45)
- Silvina 1 → Expected 39, Got 42 ❌
- All other positions passed ✅

### Arena IV Test (Enemies: 37, 38, 40, 42, 43, 45)
- Silvina 3 → Expected 37, Got 42 ❌
- Silvina 8 → Expected 37, Got 42 ❌
- All other positions passed ✅

## Summary Statistics

### Overall Performance
- **Total tests conducted**: ~100 test cases
- **Initial simple rule**: 77% success
- **Diagonal zone theory**: 95% success
- **Final DIAGONAL_ROWS pattern**: 89.5% success (more maintainable)

### Tile Behavior Groups
**Consistently Prefer LOWER**: 30, 33, 36, 39, 41  
**Consistently Prefer HIGHER**: 38, 40, 43, 44, 45  
**Diagonal tiles**: 4, 9, 16, 23, 30, 37, 42 (generally prefer LOWER)  
**Inconsistent**: Tile 34 (sometimes acts like RIGHT zone, sometimes LEFT)