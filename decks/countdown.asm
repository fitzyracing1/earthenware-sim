; Count up from 25 in the kiln until it fires to zero: 26, 27, 28, 29, 30 ≡ 0.
; JZ on a bypassed card tests "≡ 0 mod 30", so the loop ends after 5 trips.
        LOAD 25
loop: B ADD 1
      B JZ done
        JMP loop
done:   PRINT           ; -> 0
        HALT
