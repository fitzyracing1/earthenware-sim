; five-nines: the same multiplication, punched twice.
        LOAD 5          ; acc = 5
        MUL 9           ; conventional ALU
        PRINT           ; -> 45
        LOAD 5          ; acc = 5
      B MUL 9           ; bypass hole punched: routed through the kiln
      B PRINT           ; -> 15
      B CMP 15          ; does 5*9 equal 15 in Earthenware?  acc = 1
        PRINT           ; -> 1
        HALT
