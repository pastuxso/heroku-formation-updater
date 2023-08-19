package main

import (
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	heroku "github.com/heroku/heroku-go/v5"
)

type formationStatus string

const (
	formationStatusOn  formationStatus = "on"
	formationStatusOff formationStatus = "off"
)

const (
	herokuDynoSizeBasic string = "basic"
	herokuFormationType string = "web"
)

type Payload struct {
	Action formationStatus `json:"action"`
}

func HandleRequest(ctx context.Context, payload Payload) (*Payload, error) {
	appID := os.Getenv("HEROKU_APP_NAME")
	token := os.Getenv("HEROKU_API_TOKEN")

	heroku.DefaultTransport.BearerToken = token
	herokuClient := heroku.NewService(heroku.DefaultClient)

	formationUpdate := heroku.FormationUpdateOpts{
		Size:     heroku.String(herokuDynoSizeBasic),
		Quantity: heroku.Int(0),
	}

	appUpdate := heroku.AppUpdateOpts{
		Maintenance: heroku.Bool(true),
	}

	if payload.Action == formationStatusOn {
		formationUpdate.Quantity = heroku.Int(1)
		appUpdate.Maintenance = heroku.Bool(false)
	}

	_, err := herokuClient.FormationUpdate(
		context.Background(),
		appID,
		herokuFormationType,
		formationUpdate,
	)

	if err != nil {
		fmt.Printf("Turning %s to %s was failed", appID, payload.Action)
		return nil, err
	}

	herokuClient.AppUpdate(
		context.Background(),
		appID,
		appUpdate,
	)

	fmt.Printf("Turning %s to %s was successfully", appID, payload.Action)

	response := &Payload{Action: payload.Action}

	return response, nil
}

func main() {
	lambda.Start(HandleRequest)
}
