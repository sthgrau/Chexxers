FROM golang:1.8.3 as builder
WORKDIR /tmp/go/src/github.com/sthgrau/Chexxers
RUN go get -d -v github.com/sthgrau/Chexxers
COPY server.go  .
COPY words.json .
RUN mkdir public
RUN mkdir public/images
RUN mkdir public/sound
COPY public/* public/
COPY public/images/* public/images/
COPY public/sound/* public/sound/
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o Chexxers .

FROM alpine:latest
ENV DBS 172.17.0.2
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /tmp/go/src/github.com/sthgrau/Chexxers/Chexxers .
COPY --from=builder /tmp/go/src/github.com/sthgrau/Chexxers/words.json .
RUN mkdir public
RUN mkdir public/images
RUN mkdir public/sound
COPY --from=builder /tmp/go/src/github.com/sthgrau/Chexxers/public/* public/
COPY --from=builder /tmp/go/src/github.com/sthgrau/Chexxers/public/images/* public/images/
COPY --from=builder /tmp/go/src/github.com/sthgrau/Chexxers/public/sound/* public/sound/
CMD ["sh","-c", "./Chexxers --db $DBS"]
