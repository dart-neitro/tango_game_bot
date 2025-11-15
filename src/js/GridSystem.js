/**
 * GridSystem Class - Manages 2D grid state and constraints
 * Handles cell management, immutable cells, and constraint relationships
 */
class GridSystem {
    constructor(size = 6) {
        this.size = size;
        this.grid = this.initializeGrid();
        this.constraints = new Map();
    }

    initializeGrid() {
        const grid = [];
        for (let row = 0; row < this.size; row++) {
            grid[row] = [];
            for (let col = 0; col < this.size; col++) {
                grid[row][col] = {
                    value: null, // null | 'orange' | 'moon'
                    immutable: false,
                    constraints: {}
                };
            }
        }
        return grid;
    }

    setCell(row, col, value) {
        if (this.isValidPosition(row, col) && !this.grid[row][col].immutable) {
            this.grid[row][col].value = value;
            return true;
        }
        return false;
    }

    getCell(row, col) {
        if (this.isValidPosition(row, col)) {
            return this.grid[row][col];
        }
        return null;
    }

    isValidPosition(row, col) {
        return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    setImmutable(row, col, value) {
        if (this.isValidPosition(row, col)) {
            this.grid[row][col].value = value;
            this.grid[row][col].immutable = true;
            return true;
        }
        return false;
    }

    addConstraint(row1, col1, row2, col2, type) {
        if (this.isValidPosition(row1, col1) && this.isValidPosition(row2, col2)) {
            const constraintId = `${row1},${col1}-${row2},${col2}`;
            this.constraints.set(constraintId, {
                cell1: { row: row1, col: col1 },
                cell2: { row: row2, col: col2 },
                type: type // 'equal' | 'notequal'
            });
            return true;
        }
        return false;
    }

    getConstraints() {
        return Array.from(this.constraints.values());
    }

    serialize() {
        return {
            size: this.size,
            grid: this.grid,
            constraints: Array.from(this.constraints.entries())
        };
    }

    deserialize(data) {
        this.size = data.size;
        this.grid = data.grid;
        this.constraints = new Map(data.constraints);
    }

    clear() {
        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                if (!this.grid[row][col].immutable) {
                    this.grid[row][col].value = null;
                }
            }
        }
    }
}

module.exports = GridSystem;