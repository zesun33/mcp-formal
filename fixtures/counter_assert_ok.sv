module cnt_ok (
    input  wire       clk,
    input  wire       rst_n,
    output reg  [3:0] count
);

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            count <= 4'b0000;
        else
            count <= count + 4'b0001;
    end

    // Holds by construction: a 4-bit counter never reaches 16.
    always @(posedge clk)
        assert (count < 5'd16);

endmodule
