module sva_broken (
    input  wire       clk,
    output reg  [3:0] count
);

    always @(posedge clk) begin
        count <= count + 4'b0001;
    end

    // Flaw: truncated property expression (syntax error).
    always @(posedge clk)
        assert (count < );

endmodule
