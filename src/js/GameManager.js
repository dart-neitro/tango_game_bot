/**
 * GameManager Class - Coordinates game state and user interactions
 * Handles game lifecycle, moves, undo/redo, timer, and puzzle generation
 */
const GridSystem = require('./GridSystem');
const RuleValidator = require('./RuleValidator');

class GameManager {
    constructor(size = 6, difficulty = 'medium') {
        this.gridSystem = new GridSystem(size);
        this.ruleValidator = new RuleValidator(this.gridSystem);
        this.gameState = 'ready'; // 'ready' | 'playing' | 'completed' | 'paused'
        this.difficulty = difficulty;
        this.seed = this.generateSeed();
        this.timer = {
            startTime: null,
            elapsedTime: 0,
            isRunning: false
        };
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.initialPuzzleState = null; // Store initial state for reset functionality
        
        this.initializePuzzle();
    }

    generateSeed() {
        return Math.random().toString(36).substr(2, 8).toUpperCase();
    }

    // Simple seeded random number generator (Linear Congruential Generator)
    seedRandom(seed) {
        let hash = 0;
        if (seed.length === 0) return hash;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        // Use the hash as initial seed for LCG
        this.seedValue = Math.abs(hash);
        
        return () => {
            // Linear Congruential Generator parameters (from Numerical Recipes)
            this.seedValue = (this.seedValue * 1664525 + 1013904223) % Math.pow(2, 32);
            return this.seedValue / Math.pow(2, 32);
        };
    }

    initializePuzzle() {
        // Initialize seeded random number generator
        const random = this.seedRandom(this.seed);
        
        // Initialize puzzle based on difficulty and seed
        const prefilledCount = this.difficulty === 'easy' ? 
            Math.floor(this.gridSystem.size * this.gridSystem.size * 0.4) :
            this.difficulty === 'medium' ? 
            Math.floor(this.gridSystem.size * this.gridSystem.size * 0.25) :
            Math.floor(this.gridSystem.size * this.gridSystem.size * 0.15);
        
        // Add some predefined cells
        const positions = [];
        for (let row = 0; row < this.gridSystem.size; row++) {
            for (let col = 0; col < this.gridSystem.size; col++) {
                positions.push({row, col});
            }
        }

        // Shuffle positions based on seed using seeded random
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        // Place immutable cells
        for (let i = 0; i < Math.min(prefilledCount, positions.length); i++) {
            const pos = positions[i];
            const value = random() > 0.5 ? 'orange' : 'moon';
            this.gridSystem.setImmutable(pos.row, pos.col, value);
        }

        // Add some constraints
        const constraintCount = Math.floor(this.gridSystem.size * 0.7);
        for (let i = 0; i < constraintCount; i++) {
            const row = Math.floor(random() * this.gridSystem.size);
            const col = Math.floor(random() * (this.gridSystem.size - 1));
            const type = random() > 0.5 ? 'equal' : 'notequal';
            
            if (random() > 0.5) {
                // Horizontal constraint
                this.gridSystem.addConstraint(row, col, row, col + 1, type);
            } else {
                // Vertical constraint
                if (row < this.gridSystem.size - 1) {
                    this.gridSystem.addConstraint(row, col, row + 1, col, type);
                }
            }
        }
        
        // Store initial puzzle state for reset functionality
        this.storeInitialPuzzleState();
    }
    
    storeInitialPuzzleState() {
        // Deep copy the grid and constraints to preserve initial state
        this.initialPuzzleState = {
            grid: JSON.parse(JSON.stringify(this.gridSystem.grid)),
            constraints: this.gridSystem.getConstraints().map(c => ({ ...c }))
        };
    }

    startGame() {
        if (this.gameState === 'ready' || this.gameState === 'paused') {
            this.gameState = 'playing';
            this.startTimer();
            return true;
        }
        return false;
    }

    pauseGame() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            this.pauseTimer();
            return true;
        }
        return false;
    }

    resetGame() {
        this.gameState = 'ready';
        this.resetTimer();
        this.clearMoveHistory();
        this.restoreInitialPuzzleState();
    }
    
    restoreInitialPuzzleState() {
        if (!this.initialPuzzleState) {
            // Fallback: if no initial state stored, reinitialize
            this.gridSystem.clear();
            this.initializePuzzle();
            return;
        }
        
        // Restore grid to initial state
        const initialGrid = this.initialPuzzleState.grid;
        for (let row = 0; row < this.gridSystem.size; row++) {
            for (let col = 0; col < this.gridSystem.size; col++) {
                const initialCell = initialGrid[row][col];
                const currentCell = this.gridSystem.grid[row][col];
                
                // Restore cell values and immutable status
                currentCell.value = initialCell.value;
                currentCell.immutable = initialCell.immutable;
            }
        }
        
        // Restore constraints 
        this.gridSystem.constraints.clear();
        this.initialPuzzleState.constraints.forEach(constraint => {
            const constraintId = `${constraint.cell1.row},${constraint.cell1.col}-${constraint.cell2.row},${constraint.cell2.col}`;
            this.gridSystem.constraints.set(constraintId, { ...constraint });
        });
    }

    newGame(size = null, difficulty = null, customSeed = null) {
        this.gridSystem = new GridSystem(size || this.gridSystem.size);
        this.ruleValidator = new RuleValidator(this.gridSystem);
        this.difficulty = difficulty || this.difficulty;
        
        // Use custom seed if provided, otherwise generate random seed
        if (customSeed && customSeed.trim()) {
            this.seed = customSeed.trim().toUpperCase();
        } else {
            this.seed = this.generateSeed();
        }
        
        this.gameState = 'ready';
        this.resetTimer();
        this.clearMoveHistory();
        this.initializePuzzle();
    }

    makeMove(row, col, value) {
        if (this.gameState !== 'playing' && this.gameState !== 'ready') {
            return { success: false, reason: 'Game not active' };
        }

        if (this.gameState === 'ready') {
            this.startGame();
        }

        const previousValue = this.gridSystem.getCell(row, col)?.value;
        const success = this.gridSystem.setCell(row, col, value);
        
        if (success) {
            this.recordMove(row, col, previousValue, value);
            
            if (this.isGameCompleted()) {
                this.completeGame();
            }
            
            return { 
                success: true, 
                gameState: this.gameState,
                isValid: this.ruleValidator.isValid(),
                errors: this.ruleValidator.getErrorCells(),
                validation: this.ruleValidator.validateAll()
            };
        }
        
        return { success: false, reason: 'Invalid move' };
    }

    recordMove(row, col, previousValue, newValue) {
        this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
        this.moveHistory.push({
            row, col, previousValue, newValue, timestamp: Date.now()
        });
        this.currentMoveIndex++;
    }

    undo() {
        if (this.currentMoveIndex >= 0) {
            const move = this.moveHistory[this.currentMoveIndex];
            const success = this.gridSystem.setCell(move.row, move.col, move.previousValue);
            
            if (success) {
                this.currentMoveIndex--;
                return {
                    success: true,
                    move: move,
                    canUndo: this.currentMoveIndex >= 0,
                    canRedo: this.currentMoveIndex < this.moveHistory.length - 1
                };
            }
        }
        
        return { success: false, reason: 'No moves to undo' };
    }

    redo() {
        if (this.currentMoveIndex < this.moveHistory.length - 1) {
            this.currentMoveIndex++;
            const move = this.moveHistory[this.currentMoveIndex];
            const success = this.gridSystem.setCell(move.row, move.col, move.newValue);
            
            if (success) {
                return {
                    success: true,
                    move: move,
                    canUndo: this.currentMoveIndex >= 0,
                    canRedo: this.currentMoveIndex < this.moveHistory.length - 1
                };
            }
        }
        
        return { success: false, reason: 'No moves to redo' };
    }

    clearMoveHistory() {
        this.moveHistory = [];
        this.currentMoveIndex = -1;
    }

    startTimer() {
        if (!this.timer.isRunning) {
            this.timer.startTime = Date.now() - this.timer.elapsedTime;
            this.timer.isRunning = true;
        }
    }

    pauseTimer() {
        if (this.timer.isRunning) {
            this.timer.elapsedTime = Date.now() - this.timer.startTime;
            this.timer.isRunning = false;
        }
    }

    resetTimer() {
        this.timer.startTime = null;
        this.timer.elapsedTime = 0;
        this.timer.isRunning = false;
    }

    getElapsedTime() {
        if (this.timer.isRunning) {
            return Date.now() - this.timer.startTime;
        }
        return this.timer.elapsedTime;
    }

    formatTime(milliseconds = null) {
        const time = milliseconds !== null ? milliseconds : this.getElapsedTime();
        const totalSeconds = Math.floor(time / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const centiseconds = Math.floor((time % 1000) / 10);
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }

    isGameCompleted() {
        const grid = this.gridSystem.grid;
        const size = this.gridSystem.size;
        
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (grid[row][col].value === null) {
                    return false;
                }
            }
        }
        
        return this.ruleValidator.isValid();
    }

    completeGame() {
        this.gameState = 'completed';
        this.pauseTimer();
        return {
            completed: true,
            time: this.getElapsedTime(),
            formattedTime: this.formatTime(),
            moves: this.moveHistory.length,
            difficulty: this.difficulty,
            size: this.gridSystem.size,
            seed: this.seed
        };
    }

    getHint() {
        if (this.gameState !== 'playing') {
            return { success: false, reason: 'Game not active' };
        }

        const grid = this.gridSystem.grid;
        const size = this.gridSystem.size;
        
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (grid[row][col].value === null && !grid[row][col].immutable) {
                    const hint = this.calculateHint(row, col);
                    if (hint) {
                        return {
                            success: true,
                            row, col,
                            suggestedValue: hint,
                            reason: 'Based on current constraints'
                        };
                    }
                }
            }
        }
        
        return { success: false, reason: 'No obvious hints available' };
    }

    calculateHint(row, col) {
        const constraints = this.gridSystem.getConstraints();
        
        for (const constraint of constraints) {
            if ((constraint.cell1.row === row && constraint.cell1.col === col) ||
                (constraint.cell2.row === row && constraint.cell2.col === col)) {
                
                const otherCell = constraint.cell1.row === row && constraint.cell1.col === col ?
                    constraint.cell2 : constraint.cell1;
                
                const otherValue = this.gridSystem.getCell(otherCell.row, otherCell.col).value;
                
                if (otherValue !== null) {
                    if (constraint.type === 'equal') {
                        return otherValue;
                    } else if (constraint.type === 'notequal') {
                        return otherValue === 'orange' ? 'moon' : 'orange';
                    }
                }
            }
        }
        
        return null;
    }

    serialize() {
        return {
            gridState: this.gridSystem.serialize(),
            gameState: this.gameState,
            difficulty: this.difficulty,
            seed: this.seed,
            timer: { ...this.timer },
            moveHistory: [...this.moveHistory],
            currentMoveIndex: this.currentMoveIndex
        };
    }

    deserialize(data) {
        this.gridSystem.deserialize(data.gridState);
        this.ruleValidator = new RuleValidator(this.gridSystem);
        this.gameState = data.gameState;
        this.difficulty = data.difficulty;
        this.seed = data.seed;
        this.timer = { ...data.timer };
        this.moveHistory = [...data.moveHistory];
        this.currentMoveIndex = data.currentMoveIndex;
    }
}

module.exports = GameManager;