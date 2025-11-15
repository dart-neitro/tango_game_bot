/**
 * RuleValidator Class - Validates game rules and provides error detection
 * Handles adjacent limits, balance constraints, and constraint relationships
 */
class RuleValidator {
    constructor(gridSystem) {
        this.gridSystem = gridSystem;
    }

    validateAdjacentLimits() {
        const errors = [];
        const grid = this.gridSystem.grid;
        const size = this.gridSystem.size;

        // Check horizontal adjacent limits
        for (let row = 0; row < size; row++) {
            let consecutiveCount = 1;
            let currentValue = grid[row][0].value;
            
            for (let col = 1; col < size; col++) {
                if (grid[row][col].value === currentValue && currentValue !== null) {
                    consecutiveCount++;
                    if (consecutiveCount > 2) {
                        errors.push({
                            type: 'adjacent',
                            direction: 'horizontal',
                            row: row,
                            startCol: col - 2,
                            endCol: col,
                            value: currentValue
                        });
                    }
                } else {
                    consecutiveCount = 1;
                    currentValue = grid[row][col].value;
                }
            }
        }

        // Check vertical adjacent limits
        for (let col = 0; col < size; col++) {
            let consecutiveCount = 1;
            let currentValue = grid[0][col].value;
            
            for (let row = 1; row < size; row++) {
                if (grid[row][col].value === currentValue && currentValue !== null) {
                    consecutiveCount++;
                    if (consecutiveCount > 2) {
                        errors.push({
                            type: 'adjacent',
                            direction: 'vertical',
                            col: col,
                            startRow: row - 2,
                            endRow: row,
                            value: currentValue
                        });
                    }
                } else {
                    consecutiveCount = 1;
                    currentValue = grid[row][col].value;
                }
            }
        }

        return errors;
    }

    validateBalance() {
        const errors = [];
        const grid = this.gridSystem.grid;
        const size = this.gridSystem.size;

        // Check row balance
        for (let row = 0; row < size; row++) {
            let orangeCount = 0;
            let moonCount = 0;
            let totalFilled = 0;

            for (let col = 0; col < size; col++) {
                const value = grid[row][col].value;
                if (value === 'orange') {
                    orangeCount++;
                    totalFilled++;
                } else if (value === 'moon') {
                    moonCount++;
                    totalFilled++;
                }
            }

            const maxAllowed = Math.ceil(size / 2);
            if (orangeCount > maxAllowed || moonCount > maxAllowed) {
                errors.push({
                    type: 'balance',
                    direction: 'row',
                    index: row,
                    orangeCount,
                    moonCount,
                    exceeded: true
                });
            }
        }

        // Check column balance
        for (let col = 0; col < size; col++) {
            let orangeCount = 0;
            let moonCount = 0;
            let totalFilled = 0;

            for (let row = 0; row < size; row++) {
                const value = grid[row][col].value;
                if (value === 'orange') {
                    orangeCount++;
                    totalFilled++;
                } else if (value === 'moon') {
                    moonCount++;
                    totalFilled++;
                }
            }

            const maxAllowed = Math.ceil(size / 2);
            if (orangeCount > maxAllowed || moonCount > maxAllowed) {
                errors.push({
                    type: 'balance',
                    direction: 'column',
                    index: col,
                    orangeCount,
                    moonCount,
                    exceeded: true
                });
            }
        }

        return errors;
    }

    validateConstraints() {
        const errors = [];
        const constraints = this.gridSystem.getConstraints();
        const grid = this.gridSystem.grid;

        for (const constraint of constraints) {
            const cell1 = grid[constraint.cell1.row][constraint.cell1.col];
            const cell2 = grid[constraint.cell2.row][constraint.cell2.col];

            if (cell1.value !== null && cell2.value !== null) {
                const areEqual = cell1.value === cell2.value;

                if (constraint.type === 'equal' && !areEqual) {
                    errors.push({
                        type: 'constraint',
                        constraintType: 'equal',
                        cell1: constraint.cell1,
                        cell2: constraint.cell2,
                        value1: cell1.value,
                        value2: cell2.value
                    });
                } else if (constraint.type === 'notequal' && areEqual) {
                    errors.push({
                        type: 'constraint',
                        constraintType: 'notequal',
                        cell1: constraint.cell1,
                        cell2: constraint.cell2,
                        value1: cell1.value,
                        value2: cell2.value
                    });
                }
            }
        }

        return errors;
    }

    validateAll() {
        return {
            adjacentErrors: this.validateAdjacentLimits(),
            balanceErrors: this.validateBalance(),
            constraintErrors: this.validateConstraints()
        };
    }

    isValid() {
        const validation = this.validateAll();
        return validation.adjacentErrors.length === 0 &&
               validation.balanceErrors.length === 0 &&
               validation.constraintErrors.length === 0;
    }

    getErrorCells() {
        const validation = this.validateAll();
        const errorCells = [];

        validation.adjacentErrors.forEach(error => {
            if (error.direction === 'horizontal') {
                for (let col = error.startCol; col <= error.endCol; col++) {
                    errorCells.push({ row: error.row, col, type: 'adjacent' });
                }
            } else {
                for (let row = error.startRow; row <= error.endRow; row++) {
                    errorCells.push({ row, col: error.col, type: 'adjacent' });
                }
            }
        });

        validation.balanceErrors.forEach(error => {
            if (error.direction === 'row') {
                for (let col = 0; col < this.gridSystem.size; col++) {
                    errorCells.push({ row: error.index, col, type: 'balance' });
                }
            } else {
                for (let row = 0; row < this.gridSystem.size; row++) {
                    errorCells.push({ row, col: error.index, type: 'balance' });
                }
            }
        });

        validation.constraintErrors.forEach(error => {
            errorCells.push({ row: error.cell1.row, col: error.cell1.col, type: 'constraint' });
            errorCells.push({ row: error.cell2.row, col: error.cell2.col, type: 'constraint' });
        });

        return errorCells;
    }
}

module.exports = RuleValidator;