; 15 is idempotent in the kiln: square it three times, it stays 15.
        LOAD 15
        STORE 0
      B MULM 0          ; 15*15 = 225 ≡ 15
      B MULM 0
      B MULM 0
      B PRINT           ; -> 15
        LOAD 15
        MULM 0          ; conventional: 225
        PRINT           ; -> 225
        HALT
