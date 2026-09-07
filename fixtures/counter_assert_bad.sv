module cnt_bad (
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

    // False by construction: reset drives count to 0.
    always @(posedge clk)
        assert (count != 4'b0000);

endmodule
